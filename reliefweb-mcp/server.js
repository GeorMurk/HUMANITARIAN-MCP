/**
 * ReliefWeb API MCP Server
 *
 * REQUIREMENTS:
 * 1. Create a .env file in the same folder (or parent) containing: RELIEFWEB_APPNAME=your-appname
 * 2. Run 'node server.js'
 *
 * API Docs: https://apidoc.reliefweb.int/
 * Base URL:  https://api.reliefweb.int/v2/
 */

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, ".env"),
  path.resolve(__dirname, "..", ".env"),
];

for (const envPath of [...new Set(envPaths)]) {
  if (!fs.existsSync(envPath)) continue;
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) return;
    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) return;
    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

const RELIEFWEB_APPNAME = process.env.RELIEFWEB_APPNAME;
const BASE_URL = "https://api.reliefweb.int/v2";

let needsInstall = false;
try {
  require.resolve("@modelcontextprotocol/sdk/server/index.js");
  require.resolve("@modelcontextprotocol/sdk/server/stdio.js");
  require.resolve("@modelcontextprotocol/sdk/types.js");
  require.resolve("axios");
} catch (e) {
  needsInstall = true;
}

if (needsInstall) {
  console.error("Installing dependencies (@modelcontextprotocol/sdk, axios)...");
  try {
    execSync("npm install @modelcontextprotocol/sdk axios", { stdio: "inherit", cwd: __dirname });
    console.error("Dependencies installed. Restarting server...\n");
    execFileSync(process.execPath, process.argv.slice(1), { stdio: "inherit" });
    process.exit(0);
  } catch (err) {
    console.error("Failed to install dependencies.");
    process.exit(1);
  }
}

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const axios = require("axios");

const server = new Server(
  { name: "reliefweb-mcp", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

// ── HTTP HELPERS ──────────────────────────────────────────────────────────────

function assertAppname() {
  if (!RELIEFWEB_APPNAME) {
    throw new Error("RELIEFWEB_APPNAME not found. Please check your .env file.");
  }
}

// POST to a list/search endpoint with a JSON body
async function callReliefWebList(endpoint, body = {}) {
  assertAppname();
  try {
    const response = await axios.post(
      `${BASE_URL}/${endpoint}`,
      body,
      {
        params: { appname: RELIEFWEB_APPNAME },
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        timeout: 15000,
      }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Request failed: ${error.message}`);
  }
}

// GET a single item by numeric ID
async function callReliefWebItem(endpoint, id, profile = "full") {
  assertAppname();
  try {
    const response = await axios.get(
      `${BASE_URL}/${endpoint}/${id}`,
      {
        params: { appname: RELIEFWEB_APPNAME, profile },
        headers: { Accept: "application/json" },
        timeout: 15000,
      }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Request failed: ${error.message}`);
  }
}

// GET a references taxonomy endpoint (directory or named sub-resource)
async function callReliefWebTaxonomy(path, params = {}) {
  assertAppname();
  try {
    const response = await axios.get(
      `${BASE_URL}/references${path}`,
      {
        params: { appname: RELIEFWEB_APPNAME, ...params },
        headers: { Accept: "application/json" },
        timeout: 15000,
      }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Request failed: ${error.message}`);
  }
}

// ── QUERY BUILDER ─────────────────────────────────────────────────────────────

/**
 * Build a ReliefWeb POST body from normalised tool arguments.
 *
 * facetFields  – array of field name strings; date fields get interval:"month",
 *                all others get limit:10 + count:desc sort.
 * fieldsInclude / fieldsExclude – arrays passed into body.fields.include / .exclude
 * filterOperator – "AND" (default) or "OR" applied to the top-level conditions array
 * queryOperator  – "AND" (default) or "OR" applied within the query value
 * preset         – "minimal" | "latest" | "analysis"
 */
function buildBody({
  query,
  queryOperator,
  filters,
  filterOperator,
  facetFields,
  limit,
  offset,
  sort,
  profile,
  preset,
  fieldsInclude,
  fieldsExclude,
}) {
  const body = {};

  if (query) {
    body.query = { value: query, operator: queryOperator || "AND" };
  }

  const conditions = filters ? filters.filter(Boolean) : [];
  if (conditions.length === 1) {
    body.filter = conditions[0];
  } else if (conditions.length > 1) {
    body.filter = { operator: filterOperator || "AND", conditions };
  }

  if (facetFields && facetFields.length > 0) {
    body.facets = facetFields.map((f) => {
      const name = f.replace(/\./g, "_");
      if (f.includes("date")) {
        return { field: f, name, interval: "month" };
      }
      return { field: f, name, limit: 10, sort: "count:desc" };
    });
  }

  body.limit = limit != null ? limit : 10;
  if (offset) body.offset = offset;
  if (sort) body.sort = Array.isArray(sort) ? sort : [sort];
  if (profile) body.profile = profile;
  if (preset) body.preset = preset;

  const fields = {};
  if (fieldsInclude && fieldsInclude.length > 0) fields.include = fieldsInclude;
  if (fieldsExclude && fieldsExclude.length > 0) fields.exclude = fieldsExclude;
  if (Object.keys(fields).length > 0) body.fields = fields;

  return body;
}

// Shared schema fragments reused across tools
const COMMON_SEARCH_PARAMS = {
  query: { type: "string", description: "Free-text search query (supports Lucene syntax)" },
  query_operator: { type: "string", description: "Boolean operator for multi-word queries: 'AND' (default) or 'OR'", enum: ["AND", "OR"] },
  preset: { type: "string", description: "Preset filter set: 'minimal' (default sensible filters), 'latest' (sort by date), 'analysis' (includes archived/expired content)", enum: ["minimal", "latest", "analysis"] },
  profile: { type: "string", description: "Field set returned: 'minimal' (name/title only), 'list' (list-suitable fields), 'full' (all fields)", enum: ["minimal", "list", "full"] },
  facet_fields: { type: "array", items: { type: "string" }, description: "Fields to facet/aggregate on (e.g. ['country', 'theme', 'date.created']). Results appear in response.embedded.facets." },
  fields_include: { type: "array", items: { type: "string" }, description: "Additional fields to include in results (used alongside profile)" },
  fields_exclude: { type: "array", items: { type: "string" }, description: "Fields to exclude from results (used alongside profile)" },
  limit: { type: "integer", description: "Number of results to return (0–1000, default 10)", default: 10 },
  offset: { type: "integer", description: "Number of results to skip for pagination (default 0)" },
  sort: { type: "string", description: "Sort order as 'field:direction' (e.g. 'date.created:desc', 'title:asc'). Defaults vary by endpoint." },
};

// ── TOOL DEFINITIONS ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [

      // ── REPORTS ─────────────────────────────────────────────────────────────
      {
        name: "search_reports",
        description: "Search ReliefWeb humanitarian reports, situation reports, maps, and analysis curated from 4,000+ sources. Supports full-text search, rich filters, faceting, and field selection. (Docs: /v2/reports)",
        inputSchema: {
          type: "object",
          properties: {
            ...COMMON_SEARCH_PARAMS,
            country: { type: "string", description: "Filter by country name (e.g. 'Kenya')" },
            primary_country: { type: "string", description: "Filter by primary/featured country name" },
            disaster: { type: "string", description: "Filter by disaster name" },
            disaster_type: { type: "string", description: "Filter by disaster type (e.g. 'Flood', 'Earthquake', 'Drought')" },
            source: { type: "string", description: "Filter by source/organization name (e.g. 'OCHA', 'WFP')" },
            theme: { type: "string", description: "Filter by theme (e.g. 'Food and Nutrition', 'Health', 'Shelter and Non-Food Items')" },
            format: { type: "string", description: "Filter by content format (e.g. 'Situation Report', 'Map', 'Analysis', 'News and Press Release')" },
            language: { type: "string", description: "Filter by language (e.g. 'English', 'French', 'Arabic')" },
            ocha_product: { type: "string", description: "Filter by OCHA product type" },
            feature: { type: "string", description: "Filter by editorial feature tag" },
            status: { type: "string", description: "Filter by status (e.g. 'published')" },
            date_from: { type: "string", description: "Created after this date (YYYY-MM-DDThh:mm:ss+00:00)" },
            date_to: { type: "string", description: "Created before this date (YYYY-MM-DDThh:mm:ss+00:00)" },
          },
        },
      },
      {
        name: "get_report",
        description: "Get a single ReliefWeb report by ID — returns full body text, attached files, images, and all metadata. (Docs: /v2/reports/{id})",
        inputSchema: {
          type: "object",
          properties: {
            report_id: { type: "integer", description: "ReliefWeb report ID" },
          },
          required: ["report_id"],
        },
      },

      // ── DISASTERS ────────────────────────────────────────────────────────────
      {
        name: "search_disasters",
        description: "Search ReliefWeb disaster situations. Each disaster aggregates related reports and updates from an event. (Docs: /v2/disasters)",
        inputSchema: {
          type: "object",
          properties: {
            ...COMMON_SEARCH_PARAMS,
            country: { type: "string", description: "Filter by country name" },
            primary_country: { type: "string", description: "Filter by primary country name" },
            type: { type: "string", description: "Filter by disaster type (e.g. 'Flood', 'Earthquake', 'Cyclone', 'Drought')" },
            status: { type: "string", description: "Filter by status: 'current', 'past', 'alert'" },
            glide: { type: "string", description: "Filter by GLIDE number (e.g. 'FL-2024-000123-KEN')" },
            featured: { type: "boolean", description: "Filter to only featured disasters" },
            date_from: { type: "string", description: "Event date after (YYYY-MM-DDThh:mm:ss+00:00)" },
            date_to: { type: "string", description: "Event date before (YYYY-MM-DDThh:mm:ss+00:00)" },
          },
        },
      },
      {
        name: "get_disaster",
        description: "Get a single ReliefWeb disaster by ID — returns full description, profile, related GLIDE numbers, and all metadata. (Docs: /v2/disasters/{id})",
        inputSchema: {
          type: "object",
          properties: {
            disaster_id: { type: "integer", description: "ReliefWeb disaster ID" },
          },
          required: ["disaster_id"],
        },
      },

      // ── COUNTRIES ────────────────────────────────────────────────────────────
      {
        name: "search_countries",
        description: "Search ReliefWeb countries and territories. Results include humanitarian profiles, key content, appeals, and useful links. (Docs: /v2/countries)",
        inputSchema: {
          type: "object",
          properties: {
            ...COMMON_SEARCH_PARAMS,
            status: { type: "string", description: "Filter by status: 'current', 'past'" },
            current: { type: "boolean", description: "Filter to only currently active countries (true = active crisis/situation)" },
          },
        },
      },
      {
        name: "get_country",
        description: "Get a single ReliefWeb country by ID — returns full profile, overview, appeals/response plans, and useful links. (Docs: /v2/countries/{id})",
        inputSchema: {
          type: "object",
          properties: {
            country_id: { type: "integer", description: "ReliefWeb country ID" },
          },
          required: ["country_id"],
        },
      },

      // ── JOBS ─────────────────────────────────────────────────────────────────
      {
        name: "search_jobs",
        description: "Search humanitarian job listings on ReliefWeb. Filter by location, organization, career category, experience, and more. (Docs: /v2/jobs)",
        inputSchema: {
          type: "object",
          properties: {
            ...COMMON_SEARCH_PARAMS,
            country: { type: "string", description: "Filter by country name" },
            city: { type: "string", description: "Filter by city name" },
            source: { type: "string", description: "Filter by hiring organization name" },
            type: { type: "string", description: "Filter by job type (e.g. 'Job - Expatriate', 'Job - National', 'Consultancy')" },
            theme: { type: "string", description: "Filter by theme/sector (e.g. 'Health', 'Logistics')" },
            career_categories: { type: "string", description: "Filter by career category (e.g. 'Coordination', 'Finance', 'Logistics/Procurement', 'Programme Management')" },
            experience: { type: "string", description: "Filter by years of experience (e.g. '0-2 years', '3-4 years', '5-9 years', '10+ years')" },
            status: { type: "string", description: "Filter by status: 'open' (default) or 'closed'" },
            date_closing_from: { type: "string", description: "Closing date on or after (YYYY-MM-DDThh:mm:ss+00:00)" },
            date_closing_to: { type: "string", description: "Closing date on or before (YYYY-MM-DDThh:mm:ss+00:00)" },
          },
        },
      },
      {
        name: "get_job",
        description: "Get a single humanitarian job listing by ID — returns full description, how-to-apply, and all metadata. (Docs: /v2/jobs/{id})",
        inputSchema: {
          type: "object",
          properties: {
            job_id: { type: "integer", description: "ReliefWeb job ID" },
          },
          required: ["job_id"],
        },
      },

      // ── TRAINING ─────────────────────────────────────────────────────────────
      {
        name: "search_training",
        description: "Search humanitarian training opportunities and courses on ReliefWeb. Filter by location, format, language, cost, and career category. (Docs: /v2/training)",
        inputSchema: {
          type: "object",
          properties: {
            ...COMMON_SEARCH_PARAMS,
            country: { type: "string", description: "Filter by country where training is held" },
            city: { type: "string", description: "Filter by city where training is held" },
            source: { type: "string", description: "Filter by organizing institution name" },
            type: { type: "string", description: "Filter by training type (e.g. 'Online', 'In-person')" },
            format: { type: "string", description: "Filter by format (e.g. 'Workshop', 'Course', 'Conference')" },
            language: { type: "string", description: "Filter by content language of training materials" },
            training_language: { type: "string", description: "Filter by language the training is delivered in" },
            career_categories: { type: "string", description: "Filter by career category (e.g. 'Coordination', 'Finance', 'Logistics/Procurement')" },
            cost: { type: "string", description: "Filter by cost: 'free' or 'fee-based'" },
            status: { type: "string", description: "Filter by status: 'open' (default) or 'closed'" },
            date_start_from: { type: "string", description: "Start date on or after (YYYY-MM-DDThh:mm:ss+00:00)" },
            date_start_to: { type: "string", description: "Start date on or before (YYYY-MM-DDThh:mm:ss+00:00)" },
            date_end_before: { type: "string", description: "End date on or before (YYYY-MM-DDThh:mm:ss+00:00)" },
            date_registration_before: { type: "string", description: "Registration deadline on or before (YYYY-MM-DDThh:mm:ss+00:00)" },
          },
        },
      },
      {
        name: "get_training",
        description: "Get a single training opportunity by ID — returns full description, how-to-register, dates, and all metadata. (Docs: /v2/training/{id})",
        inputSchema: {
          type: "object",
          properties: {
            training_id: { type: "integer", description: "ReliefWeb training ID" },
          },
          required: ["training_id"],
        },
      },

      // ── SOURCES ──────────────────────────────────────────────────────────────
      {
        name: "search_sources",
        description: "Search ReliefWeb source organizations — UN agencies, NGOs, governments, research institutions, and media that contribute content. (Docs: /v2/sources)",
        inputSchema: {
          type: "object",
          properties: {
            ...COMMON_SEARCH_PARAMS,
            country: { type: "string", description: "Filter by country the source is associated with" },
            type: { type: "string", description: "Filter by organization type (e.g. 'International Organization', 'NGO', 'Government', 'Academic / Research')" },
            content_type: { type: "string", description: "Filter by the type of content the source publishes" },
            status: { type: "string", description: "Filter by status: 'active', 'inactive'" },
          },
        },
      },
      {
        name: "get_source",
        description: "Get a single source organization by ID — returns description, homepage, disclaimer, FTS ID, and all metadata. (Docs: /v2/sources/{id})",
        inputSchema: {
          type: "object",
          properties: {
            source_id: { type: "integer", description: "ReliefWeb source ID" },
          },
          required: ["source_id"],
        },
      },

      // ── BLOG ─────────────────────────────────────────────────────────────────
      {
        name: "search_blog",
        description: "Search ReliefWeb blog posts about humanitarian ideas, projects, and site improvements. (Docs: /v2/blog)",
        inputSchema: {
          type: "object",
          properties: {
            ...COMMON_SEARCH_PARAMS,
            author: { type: "string", description: "Filter by author name" },
            tags: { type: "string", description: "Filter by tag (e.g. 'API', 'Data', 'Maps')" },
            status: { type: "string", description: "Filter by status (e.g. 'published')" },
            date_from: { type: "string", description: "Published after (YYYY-MM-DDThh:mm:ss+00:00)" },
            date_to: { type: "string", description: "Published before (YYYY-MM-DDThh:mm:ss+00:00)" },
          },
        },
      },
      {
        name: "get_blog",
        description: "Get a single ReliefWeb blog post by ID — returns full body text, author, image, and all metadata. (Docs: /v2/blog/{id})",
        inputSchema: {
          type: "object",
          properties: {
            blog_id: { type: "integer", description: "ReliefWeb blog post ID" },
          },
          required: ["blog_id"],
        },
      },

      // ── BOOK ─────────────────────────────────────────────────────────────────
      {
        name: "search_book",
        description: "Search ReliefWeb book/static site content — help pages, location maps, editorial guidelines, and other reference pages published on the ReliefWeb site. (Docs: /v2/book)",
        inputSchema: {
          type: "object",
          properties: {
            ...COMMON_SEARCH_PARAMS,
            status: { type: "string", description: "Filter by status (e.g. 'published')" },
            date_from: { type: "string", description: "Created after (YYYY-MM-DDThh:mm:ss+00:00)" },
            date_to: { type: "string", description: "Created before (YYYY-MM-DDThh:mm:ss+00:00)" },
          },
        },
      },
      {
        name: "get_book",
        description: "Get a single ReliefWeb book/static page by ID — returns full body text and all metadata. (Docs: /v2/book/{id})",
        inputSchema: {
          type: "object",
          properties: {
            book_id: { type: "integer", description: "ReliefWeb book page ID" },
          },
          required: ["book_id"],
        },
      },

      // ── REFERENCES (TAXONOMIES) ───────────────────────────────────────────────
      {
        name: "get_references_directory",
        description: "Get the ReliefWeb taxonomy directory — lists all available reference vocabularies (career-categories, disaster-types, themes, languages, organization-types, etc.) with their API field mappings. Use this to discover what taxonomies are available before calling get_reference_taxonomy. (Docs: /v2/references)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_reference_taxonomy",
        description: "Get the items in a specific ReliefWeb taxonomy/vocabulary. Use get_references_directory first to see available taxonomy names. Available taxonomies: career-categories, content-formats, disaster-types, features, job-experience, job-types, languages, ocha-products, organization-types, themes, training-formats, training-types, vulnerable-groups. (Docs: /v2/references/{taxonomy})",
        inputSchema: {
          type: "object",
          properties: {
            taxonomy: {
              type: "string",
              description: "Taxonomy name (e.g. 'themes', 'disaster-types', 'career-categories', 'languages', 'organization-types')",
              enum: [
                "career-categories",
                "content-formats",
                "disaster-types",
                "features",
                "job-experience",
                "job-types",
                "languages",
                "ocha-products",
                "organization-types",
                "themes",
                "training-formats",
                "training-types",
                "vulnerable-groups",
              ],
            },
            limit: { type: "integer", description: "Number of items to return (default 50)", default: 50 },
            offset: { type: "integer", description: "Number of items to skip for pagination" },
          },
          required: ["taxonomy"],
        },
      },
    ],
  };
});

// ── TOOL EXECUTION ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;

    switch (name) {

      // ── REPORTS ───────────────────────────────────────────────────────────────
      case "search_reports": {
        const filters = [
          args.country        && { field: "country.name.exact",      value: args.country },
          args.primary_country && { field: "primary_country.name.exact", value: args.primary_country },
          args.disaster       && { field: "disaster.name.exact",     value: args.disaster },
          args.disaster_type  && { field: "disaster_type.name.exact", value: args.disaster_type },
          args.source         && { field: "source.name.exact",       value: args.source },
          args.theme          && { field: "theme.name.exact",        value: args.theme },
          args.format         && { field: "format.name.exact",       value: args.format },
          args.language       && { field: "language.name.exact",     value: args.language },
          args.ocha_product   && { field: "ocha_product.name.exact", value: args.ocha_product },
          args.feature        && { field: "feature.name.exact",      value: args.feature },
          args.status         && { field: "status",                  value: args.status },
          (args.date_from || args.date_to) && {
            field: "date.created",
            value: { from: args.date_from, to: args.date_to },
          },
        ];
        result = await callReliefWebList("reports", buildBody({
          query: args.query,
          queryOperator: args.query_operator,
          filters,
          facetFields: args.facet_fields,
          limit: args.limit,
          offset: args.offset,
          sort: args.sort || "date.created:desc",
          profile: args.profile || "list",
          preset: args.preset,
          fieldsInclude: args.fields_include,
          fieldsExclude: args.fields_exclude,
        }));
        break;
      }
      case "get_report":
        result = await callReliefWebItem("reports", args.report_id, "full");
        break;

      // ── DISASTERS ─────────────────────────────────────────────────────────────
      case "search_disasters": {
        const filters = [
          args.country         && { field: "country.name.exact",         value: args.country },
          args.primary_country && { field: "primary_country.name.exact", value: args.primary_country },
          args.type            && { field: "type.name.exact",            value: args.type },
          args.status          && { field: "status",                     value: args.status },
          args.glide           && { field: "glide",                      value: args.glide },
          args.featured != null && { field: "featured",                  value: args.featured },
          (args.date_from || args.date_to) && {
            field: "date.event",
            value: { from: args.date_from, to: args.date_to },
          },
        ];
        result = await callReliefWebList("disasters", buildBody({
          query: args.query,
          queryOperator: args.query_operator,
          filters,
          facetFields: args.facet_fields,
          limit: args.limit,
          offset: args.offset,
          sort: args.sort || "date.event:desc",
          profile: args.profile || "list",
          preset: args.preset,
          fieldsInclude: args.fields_include,
          fieldsExclude: args.fields_exclude,
        }));
        break;
      }
      case "get_disaster":
        result = await callReliefWebItem("disasters", args.disaster_id, "full");
        break;

      // ── COUNTRIES ─────────────────────────────────────────────────────────────
      case "search_countries": {
        const filters = [
          args.status  && { field: "status",  value: args.status },
          args.current != null && { field: "current", value: args.current },
        ];
        result = await callReliefWebList("countries", buildBody({
          query: args.query,
          queryOperator: args.query_operator,
          filters,
          facetFields: args.facet_fields,
          limit: args.limit,
          offset: args.offset,
          sort: args.sort || "name:asc",
          profile: args.profile || "list",
          preset: args.preset,
          fieldsInclude: args.fields_include,
          fieldsExclude: args.fields_exclude,
        }));
        break;
      }
      case "get_country":
        result = await callReliefWebItem("countries", args.country_id, "full");
        break;

      // ── JOBS ──────────────────────────────────────────────────────────────────
      case "search_jobs": {
        const filters = [
          args.country           && { field: "country.name.exact",          value: args.country },
          args.city              && { field: "city.name.exact",             value: args.city },
          args.source            && { field: "source.name.exact",           value: args.source },
          args.type              && { field: "type.name.exact",             value: args.type },
          args.theme             && { field: "theme.name.exact",            value: args.theme },
          args.career_categories && { field: "career_categories.name.exact", value: args.career_categories },
          args.experience        && { field: "experience.name.exact",       value: args.experience },
          args.status            && { field: "status",                      value: args.status },
          (args.date_closing_from || args.date_closing_to) && {
            field: "date.closing",
            value: { from: args.date_closing_from, to: args.date_closing_to },
          },
        ];
        result = await callReliefWebList("jobs", buildBody({
          query: args.query,
          queryOperator: args.query_operator,
          filters,
          facetFields: args.facet_fields,
          limit: args.limit,
          offset: args.offset,
          sort: args.sort || "date.closing:asc",
          profile: args.profile || "list",
          preset: args.preset,
          fieldsInclude: args.fields_include,
          fieldsExclude: args.fields_exclude,
        }));
        break;
      }
      case "get_job":
        result = await callReliefWebItem("jobs", args.job_id, "full");
        break;

      // ── TRAINING ──────────────────────────────────────────────────────────────
      case "search_training": {
        const filters = [
          args.country              && { field: "country.name.exact",           value: args.country },
          args.city                 && { field: "city.name.exact",              value: args.city },
          args.source               && { field: "source.name.exact",            value: args.source },
          args.type                 && { field: "type.name.exact",              value: args.type },
          args.format               && { field: "format.name.exact",            value: args.format },
          args.language             && { field: "language.name.exact",          value: args.language },
          args.training_language    && { field: "training_language.name.exact", value: args.training_language },
          args.career_categories    && { field: "career_categories.name.exact", value: args.career_categories },
          args.cost                 && { field: "cost",                         value: args.cost },
          args.status               && { field: "status",                       value: args.status },
          (args.date_start_from || args.date_start_to) && {
            field: "date.start",
            value: { from: args.date_start_from, to: args.date_start_to },
          },
          args.date_end_before && {
            field: "date.end",
            value: { to: args.date_end_before },
          },
          args.date_registration_before && {
            field: "date.registration",
            value: { to: args.date_registration_before },
          },
        ];
        result = await callReliefWebList("training", buildBody({
          query: args.query,
          queryOperator: args.query_operator,
          filters,
          facetFields: args.facet_fields,
          limit: args.limit,
          offset: args.offset,
          sort: args.sort || "date.start:asc",
          profile: args.profile || "list",
          preset: args.preset,
          fieldsInclude: args.fields_include,
          fieldsExclude: args.fields_exclude,
        }));
        break;
      }
      case "get_training":
        result = await callReliefWebItem("training", args.training_id, "full");
        break;

      // ── SOURCES ───────────────────────────────────────────────────────────────
      case "search_sources": {
        const filters = [
          args.country      && { field: "country.name.exact", value: args.country },
          args.type         && { field: "type.name.exact",    value: args.type },
          args.content_type && { field: "content_type",       value: args.content_type },
          args.status       && { field: "status",             value: args.status },
        ];
        result = await callReliefWebList("sources", buildBody({
          query: args.query,
          queryOperator: args.query_operator,
          filters,
          facetFields: args.facet_fields,
          limit: args.limit,
          offset: args.offset,
          sort: args.sort || "name:asc",
          profile: args.profile || "list",
          preset: args.preset,
          fieldsInclude: args.fields_include,
          fieldsExclude: args.fields_exclude,
        }));
        break;
      }
      case "get_source":
        result = await callReliefWebItem("sources", args.source_id, "full");
        break;

      // ── BLOG ──────────────────────────────────────────────────────────────────
      case "search_blog": {
        const filters = [
          args.author  && { field: "author.exact", value: args.author },
          args.tags    && { field: "tags.exact",   value: args.tags },
          args.status  && { field: "status",       value: args.status },
          (args.date_from || args.date_to) && {
            field: "date.created",
            value: { from: args.date_from, to: args.date_to },
          },
        ];
        result = await callReliefWebList("blog", buildBody({
          query: args.query,
          queryOperator: args.query_operator,
          filters,
          facetFields: args.facet_fields,
          limit: args.limit,
          offset: args.offset,
          sort: args.sort || "date.created:desc",
          profile: args.profile || "list",
          preset: args.preset,
          fieldsInclude: args.fields_include,
          fieldsExclude: args.fields_exclude,
        }));
        break;
      }
      case "get_blog":
        result = await callReliefWebItem("blog", args.blog_id, "full");
        break;

      // ── BOOK ──────────────────────────────────────────────────────────────────
      case "search_book": {
        const filters = [
          args.status && { field: "status", value: args.status },
          (args.date_from || args.date_to) && {
            field: "date.created",
            value: { from: args.date_from, to: args.date_to },
          },
        ];
        result = await callReliefWebList("book", buildBody({
          query: args.query,
          queryOperator: args.query_operator,
          filters,
          facetFields: args.facet_fields,
          limit: args.limit,
          offset: args.offset,
          sort: args.sort || "date.changed:desc",
          profile: args.profile || "list",
          preset: args.preset,
          fieldsInclude: args.fields_include,
          fieldsExclude: args.fields_exclude,
        }));
        break;
      }
      case "get_book":
        result = await callReliefWebItem("book", args.book_id, "full");
        break;

      // ── REFERENCES (TAXONOMIES) ───────────────────────────────────────────────
      case "get_references_directory":
        result = await callReliefWebTaxonomy("");
        break;

      case "get_reference_taxonomy":
        result = await callReliefWebTaxonomy(`/${args.taxonomy}`, {
          limit: args.limit || 50,
          ...(args.offset ? { offset: args.offset } : {}),
        });
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
});

// ── START ─────────────────────────────────────────────────────────────────────

async function run() {
  if (!RELIEFWEB_APPNAME) {
    console.error("FATAL: Cannot start server. Missing RELIEFWEB_APPNAME in .env file.");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ReliefWeb MCP Server v2.0.0 running on stdio (appname loaded from .env)");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
