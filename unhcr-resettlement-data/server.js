/**
 * UNHCR Global Resettlement Data (RSQ) MCP Server
 *
 * Public API — no authentication required.
 * API Docs: https://api.unhcr.org/docs/
 * Run: node server.js
 */

const { execFileSync, execSync } = require('child_process');

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
  console.log("Installing dependencies (@modelcontextprotocol/sdk, axios)...");
  try {
    execSync("npm install @modelcontextprotocol/sdk axios", { stdio: "inherit" });
    console.log("Dependencies installed. Restarting server...\n");
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

const BASE_URL = "https://api.unhcr.org/rsq/v1";

const server = new Server(
  { name: "unhcr-resettlement-data-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

async function callRsqApi(endpoint, params = {}, { raw = false } = {}) {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
  );
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: cleanParams,
      headers: { Accept: raw ? "text/csv" : "application/json" },
      responseType: raw ? "text" : "json",
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Request failed: ${error.message}`);
  }
}

// Shared filter params used across query endpoints
const QUERY_PARAMS = {
  language: { type: "string", description: "Response language: 'en' (default) or 'fr'" },
  page: { type: "integer", description: "Pagination page number (20 results per page)" },
  year: { type: "string", description: "Filter by year(s), comma-separated (e.g. '2022,2023')" },
  origin: { type: "string", description: "Filter by country of origin code(s), comma-separated" },
  asylum: { type: "string", description: "Filter by country of asylum code(s), comma-separated" },
  resettlement: { type: "string", description: "Filter by resettlement destination country code(s), comma-separated" },
  originCompare: { type: "string", description: "Group results by origin country comparison" },
  asylumCompare: { type: "string", description: "Group results by asylum country comparison" },
  yearSort: { type: "string", description: "Sort by year: 'asc' or 'desc'" },
  originSort: { type: "string", description: "Sort by origin country name: 'asc' or 'desc'" },
  asylumSort: { type: "string", description: "Sort by asylum country name: 'asc' or 'desc'" },
  resettlementSort: { type: "string", description: "Sort by resettlement country name: 'asc' or 'desc'" },
  personsSort: { type: "string", description: "Sort by number of persons: 'asc' or 'desc'" },
};

// --- TOOL DEFINITIONS ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [

      // ── LOOKUP — CATEGORIES & REGIONS ────────────────────────────────────────
      {
        name: "get_resettlement_categories",
        description: "Get all UNHCR resettlement submission category codes and names (e.g. NEED, SML, WOM). (Docs: /rsq/v1/categories)",
        inputSchema: {
          type: "object",
          properties: {
            language: { type: "string", description: "Response language: 'en' (default) or 'fr'" },
          },
        },
      },
      {
        name: "get_rsq_regions",
        description: "Get UNHCR regional groupings used to categorise countries of asylum. (Docs: /rsq/v1/regions)",
        inputSchema: {
          type: "object",
          properties: {
            language: { type: "string", description: "Response language: 'en' (default) or 'fr'" },
          },
        },
      },

      // ── LOOKUP — YEARS ────────────────────────────────────────────────────────
      {
        name: "get_rsq_years",
        description: "Get available years for which resettlement submissions and departures data exist. (Docs: /rsq/v1/years)",
        inputSchema: {
          type: "object",
          properties: {
            language: { type: "string", description: "Response language: 'en' (default) or 'fr'" },
          },
        },
      },
      {
        name: "get_rsq_years_demographics",
        description: "Get available years for which resettlement submissions demographic data exists. (Docs: /rsq/v1/years/demographics)",
        inputSchema: {
          type: "object",
          properties: {
            language: { type: "string", description: "Response language: 'en' (default) or 'fr'" },
          },
        },
      },

      // ── LOOKUP — COUNTRIES ────────────────────────────────────────────────────
      {
        name: "get_countries_of_asylum",
        description: "Get all available countries of asylum in the resettlement dataset. (Docs: /rsq/v1/asylums)",
        inputSchema: {
          type: "object",
          properties: {
            language: { type: "string", description: "Response language: 'en' (default) or 'fr'" },
          },
        },
      },
      {
        name: "get_origin_countries_submissions",
        description: "Get countries of origin that have resettlement submissions data. (Docs: /rsq/v1/origins/submissions)",
        inputSchema: {
          type: "object",
          properties: {
            language: { type: "string", description: "Response language: 'en' (default) or 'fr'" },
          },
        },
      },
      {
        name: "get_origin_countries_departures",
        description: "Get countries of origin that have resettlement departures data. (Docs: /rsq/v1/origins/departures)",
        inputSchema: {
          type: "object",
          properties: {
            language: { type: "string", description: "Response language: 'en' (default) or 'fr'" },
          },
        },
      },
      {
        name: "get_origin_countries_demographics",
        description: "Get countries of origin that have resettlement demographics data. (Docs: /rsq/v1/origins/demographics)",
        inputSchema: {
          type: "object",
          properties: {
            language: { type: "string", description: "Response language: 'en' (default) or 'fr'" },
          },
        },
      },
      {
        name: "get_resettlement_destinations",
        description: "Get all available resettlement destination countries. (Docs: /rsq/v1/destinations)",
        inputSchema: {
          type: "object",
          properties: {
            language: { type: "string", description: "Response language: 'en' (default) or 'fr'" },
          },
        },
      },

      // ── QUERY — SUBMISSIONS ───────────────────────────────────────────────────
      {
        name: "get_resettlement_submissions",
        description: "Get paginated resettlement submissions data (UNHCR referrals to resettlement countries). Returns 20 results per page. Filter by year, country of origin, country of asylum, and destination. (Docs: /rsq/v1/submissions)",
        inputSchema: {
          type: "object",
          properties: { ...QUERY_PARAMS },
        },
      },

      // ── QUERY — DEPARTURES ────────────────────────────────────────────────────
      {
        name: "get_resettlement_departures",
        description: "Get paginated resettlement departures data (persons who actually departed to resettlement countries). Returns 20 results per page. Filter by year, country of origin, country of asylum, and destination. (Docs: /rsq/v1/departures)",
        inputSchema: {
          type: "object",
          properties: { ...QUERY_PARAMS },
        },
      },

      // ── QUERY — DEMOGRAPHICS ──────────────────────────────────────────────────
      {
        name: "get_resettlement_demographics",
        description: "Get resettlement submissions demographic breakdown by age and gender. Filter by year, country of origin, and resettlement destination. (Docs: /rsq/v1/demographics)",
        inputSchema: {
          type: "object",
          properties: {
            language: { type: "string", description: "Response language: 'en' (default) or 'fr'" },
            year: { type: "string", description: "Filter by year(s), comma-separated" },
            origin: { type: "string", description: "Filter by country of origin code(s), comma-separated" },
            originCompare: { type: "string", description: "Group results by origin country comparison" },
            resettlement: { type: "string", description: "Filter by resettlement destination country code(s)" },
          },
        },
      },

      // ── HELPER ────────────────────────────────────────────────────────────────
      {
        name: "resolve_rsq_url_hash",
        description: "Decode a UNHCR RSQ URL hash back into its full query URL. Useful for reconstructing saved queries. (Docs: /rsq/v1/fetchUrl)",
        inputSchema: {
          type: "object",
          properties: {
            urlHash: { type: "string", description: "The encoded URL hash to decode" },
            language: { type: "string", description: "Response language: 'en' (default) or 'fr'" },
          },
          required: ["urlHash"],
        },
      },
      {
        name: "export_rsq_csv",
        description: "Export resettlement query results as a CSV. Specify the data type (submissions or departures) and any filters. (Docs: /rsq/v1/export/csv)",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string", description: "Data type to export: 'submissions' or 'departures'" },
            year: { type: "string", description: "Filter by year(s), comma-separated" },
            origin: { type: "string", description: "Filter by country of origin code(s), comma-separated" },
            asylum: { type: "string", description: "Filter by country of asylum code(s), comma-separated" },
            resettlement: { type: "string", description: "Filter by resettlement destination code(s), comma-separated" },
          },
          required: ["type"],
        },
      },
    ],
  };
});

// --- TOOL EXECUTION ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;

    switch (name) {

      // CATEGORIES & REGIONS
      case "get_resettlement_categories":
        result = await callRsqApi("/categories", { language: args.language });
        break;
      case "get_rsq_regions":
        result = await callRsqApi("/regions", { language: args.language });
        break;

      // YEARS
      case "get_rsq_years":
        result = await callRsqApi("/years", { language: args.language });
        break;
      case "get_rsq_years_demographics":
        result = await callRsqApi("/years/demographics", { language: args.language });
        break;

      // COUNTRIES
      case "get_countries_of_asylum":
        result = await callRsqApi("/asylums", { language: args.language });
        break;
      case "get_origin_countries_submissions":
        result = await callRsqApi("/origins/submissions", { language: args.language });
        break;
      case "get_origin_countries_departures":
        result = await callRsqApi("/origins/departures", { language: args.language });
        break;
      case "get_origin_countries_demographics":
        result = await callRsqApi("/origins/demographics", { language: args.language });
        break;
      case "get_resettlement_destinations":
        result = await callRsqApi("/destinations", { language: args.language });
        break;

      // SUBMISSIONS
      case "get_resettlement_submissions":
        result = await callRsqApi("/submissions", {
          language: args.language,
          page: args.page,
          year: args.year,
          origin: args.origin,
          asylum: args.asylum,
          resettlement: args.resettlement,
          originCompare: args.originCompare,
          asylumCompare: args.asylumCompare,
          yearSort: args.yearSort,
          originSort: args.originSort,
          asylumSort: args.asylumSort,
          resettlementSort: args.resettlementSort,
          personsSort: args.personsSort,
        });
        break;

      // DEPARTURES
      case "get_resettlement_departures":
        result = await callRsqApi("/departures", {
          language: args.language,
          page: args.page,
          year: args.year,
          origin: args.origin,
          asylum: args.asylum,
          resettlement: args.resettlement,
          originCompare: args.originCompare,
          asylumCompare: args.asylumCompare,
          yearSort: args.yearSort,
          originSort: args.originSort,
          asylumSort: args.asylumSort,
          resettlementSort: args.resettlementSort,
          personsSort: args.personsSort,
        });
        break;

      // DEMOGRAPHICS
      case "get_resettlement_demographics":
        result = await callRsqApi("/demographics", {
          language: args.language,
          year: args.year,
          origin: args.origin,
          originCompare: args.originCompare,
          resettlement: args.resettlement,
        });
        break;

      // HELPER
      case "resolve_rsq_url_hash":
        result = await callRsqApi("/fetchUrl", {
          urlHash: args.urlHash,
          language: args.language,
        });
        break;
      case "export_rsq_csv": {
        const csvData = await callRsqApi("/export/csv", {
          type: args.type,
          year: args.year,
          origin: args.origin,
          asylum: args.asylum,
          resettlement: args.resettlement,
        }, { raw: true });
        return { content: [{ type: "text", text: csvData }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
});

// --- START ---
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("UNHCR Resettlement Data (RSQ) MCP Server v1.0.0 running on stdio");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
