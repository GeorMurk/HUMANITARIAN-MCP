/**
 * World Bank Data360 API MCP Server
 *
 * Wraps the World Bank Data360 platform API:
 *   https://data360.worldbank.org/en/api   (base: https://data360api.worldbank.org)
 *
 * Data360 consolidates 40x more data than the legacy open-data portal: indicators
 * and datasets from across the World Bank Group (WDI, IMF, UN, OECD, …) covering
 * 200+ economies, with structured metadata and time-series observations.
 *
 * This is a public, unauthenticated API — no API token is required.
 *
 * Typical discovery flow:
 *   1. search_indicators("population") -> returns indicator `idno` + `databases[].idno`
 *   2. get_dimensions(database_id, indicator_id) -> available REF_AREA / FREQ / SEX / AGE filters
 *   3. get_data(database_id, indicator_id, ref_area=...) -> time-series observations
 *
 * REQUIREMENTS:
 * 1. Run 'node server.js' (dependencies auto-install on first run)
 * 2. (Optional) A .env file may set DATA360_API_BASE to override the base URL.
 */

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file (optional)
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

const BASE_URL = process.env.DATA360_API_BASE || "https://data360api.worldbank.org";

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

const server = new Server(
  { name: "worldbankdata360-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// GET request with query params
async function getData360(endpoint, params = {}) {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== "")
  );
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: cleanParams,
      headers: { Accept: "application/json" },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Request failed: ${error.message}`);
  }
}

// POST request with JSON body
async function postData360(endpoint, body = {}) {
  const cleanBody = Object.fromEntries(
    Object.entries(body).filter(([_, v]) => v !== undefined && v !== null && v !== "")
  );
  try {
    const response = await axios.post(`${BASE_URL}${endpoint}`, cleanBody, {
      headers: { Accept: "*/*", "Content-Type": "application/json" },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Request failed: ${error.message}`);
  }
}

// --- TOOL DEFINITIONS ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [

      // ── SEARCH ──────────────────────────────────────────────────────────────
      {
        name: "search_indicators",
        description:
          "Search Data360 indicators and datasets by free text. START HERE when you don't already have IDs. " +
          "Each result gives the indicator `idno` and its `databases[].idno` — the two values needed by " +
          "get_data, get_metadata, get_dimensions and list_indicators. Also returns economies_count, " +
          "time_period coverage, frequency and dimensions. (POST /data360/portal/v1/public_data360_search)",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Free-text search term (e.g. 'population', 'GDP', 'maternal mortality')" },
            type: { type: "string", description: "What to search for: 'indicator' (default) or 'dataset'", enum: ["indicator", "dataset"], default: "indicator" },
            items_per_page: { type: "integer", description: "Max results to return (default 10)", default: 10 },
            skip: { type: "integer", description: "Results to skip for pagination (default 0)" },
          },
          required: ["query"],
        },
      },

      // ── DATA ────────────────────────────────────────────────────────────────
      {
        name: "get_data",
        description:
          "Retrieve time-series observations for an indicator. Requires database_id and indicator_id " +
          "(get them from search_indicators). Returns OBS_VALUE per TIME_PERIOD with dimension codes. " +
          "(GET /data360/data)",
        inputSchema: {
          type: "object",
          properties: {
            database_id: { type: "string", description: "Database/dataset ID, e.g. 'WB_WDI' (DATABASE_ID)" },
            indicator_id: { type: "string", description: "Indicator ID, e.g. 'WB_WDI_SP_POP_TOTL' (INDICATOR)" },
            ref_area: { type: "string", description: "ISO3 country/economy code(s), comma-separated for multiple, e.g. 'KEN' or 'KEN,UGA,TZA' (REF_AREA)" },
            time_period: { type: "string", description: "Single time period to fetch, e.g. '2020' (TIME_PERIOD). Use time_from/time_to for a range." },
            time_from: { type: "string", description: "Start year, e.g. '2010' (timePeriodFrom)" },
            time_to: { type: "string", description: "End year, e.g. '2023' (timePeriodTo)" },
            sex: { type: "string", description: "SEX dimension code (e.g. '_T' total, 'F', 'M')" },
            age: { type: "string", description: "AGE dimension code (e.g. '_T' total)" },
            urbanisation: { type: "string", description: "URBANISATION dimension code (e.g. '_T' total)" },
            freq: { type: "string", description: "Frequency code (e.g. 'A' annual)" },
            unit_measure: { type: "string", description: "UNIT_MEASURE dimension code" },
            unit_type: { type: "string", description: "UNIT_TYPE code (e.g. 'currency', 'percentage')" },
            unit_mult: { type: "string", description: "UNIT_MULT — multiplier for the unit" },
            comp_breakdown_1: { type: "string", description: "COMP_BREAKDOWN_1 dimension code" },
            comp_breakdown_2: { type: "string", description: "COMP_BREAKDOWN_2 dimension code" },
            comp_breakdown_3: { type: "string", description: "COMP_BREAKDOWN_3 dimension code" },
            skip: { type: "integer", description: "Records to skip for pagination (each call returns max 1000 rows)" },
          },
          required: ["database_id", "indicator_id"],
        },
      },

      // ── INDICATORS LISTING ──────────────────────────────────────────────────
      {
        name: "list_indicators",
        description:
          "List all indicator IDs available in a given database/dataset. Prefer search_indicators for " +
          "discovery; use this to enumerate everything under a database you already know " +
          "(e.g. 'WB_WDI'). Returns an array of indicator ID strings. (GET /data360/indicators)",
        inputSchema: {
          type: "object",
          properties: {
            database_id: { type: "string", description: "Database/dataset ID, e.g. 'WB_WDI' (datasetId)" },
          },
          required: ["database_id"],
        },
      },

      // ── METADATA ────────────────────────────────────────────────────────────
      {
        name: "get_metadata",
        description:
          "Get rich metadata for an indicator: name, definition, source, methodology, classifications, " +
          "codelists and disaggregation types. (POST /data360/metadata)",
        inputSchema: {
          type: "object",
          properties: {
            indicator_id: { type: "string", description: "Indicator ID, e.g. 'WB_WDI_SP_POP_TOTL'" },
            select_fields: {
              type: "array",
              items: { type: "string" },
              description: "Optional list of series_description fields to return (e.g. ['name','definition','idno']). Omit for all fields.",
            },
          },
          required: ["indicator_id"],
        },
      },

      // ── DIMENSIONS ──────────────────────────────────────────────────────────
      {
        name: "get_dimensions",
        description:
          "List the available filter values for an indicator: which REF_AREA (countries), FREQ, SEX, AGE, " +
          "UNIT_MEASURE and other dimension codes actually have data. Use this before get_data to know " +
          "valid filter codes. (POST /data360/portal/v1/dimensions)",
        inputSchema: {
          type: "object",
          properties: {
            database_id: { type: "string", description: "Database/dataset ID, e.g. 'WB_WDI'" },
            indicator_id: { type: "string", description: "Indicator ID, e.g. 'WB_WDI_SP_POP_TOTL'" },
          },
          required: ["database_id", "indicator_id"],
        },
      },

      // ── DISAGGREGATION (documented endpoint) ────────────────────────────────
      {
        name: "get_disaggregation",
        description:
          "Get the available disaggregation values for an indicator: the list of REF_AREA, FREQ, SEX, AGE " +
          "and other dimension codes that have data. This is the officially documented endpoint " +
          "(get_dimensions returns the same information with richer labels via the portal API). " +
          "(GET /data360/disaggregation)",
        inputSchema: {
          type: "object",
          properties: {
            database_id: { type: "string", description: "Database/dataset ID, e.g. 'WB_WDI' (datasetId)" },
            indicator_id: { type: "string", description: "Indicator ID, e.g. 'WB_WDI_SP_POP_TOTL' (indicatorId)" },
          },
          required: ["database_id"],
        },
      },

      // ── ADVANCED SEARCH (documented searchv2 endpoint) ──────────────────────
      {
        name: "search",
        description:
          "Advanced metadata search over the Data360 catalog — the officially documented search endpoint. " +
          "Exposes the raw Azure Cognitive Search query surface (full-text `search`, OData `filter`, " +
          "`orderby`, `select`, `searchFields`, `facets`). Use this for precise/faceted queries; for " +
          "simple discovery prefer search_indicators. (POST /data360/searchv2)",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Full-text search text (e.g. 'maternal mortality'). Use '*' to match all." },
            filter: { type: "string", description: "OData $filter expression, e.g. \"series_description/database_id eq 'WB_WDI'\"" },
            orderby: { type: "string", description: "OData $orderby expression, e.g. 'data_last_updated desc'" },
            select: { type: "string", description: "Comma-separated fields to return" },
            searchFields: { type: "string", description: "Comma-separated fields to search within" },
            facets: { type: "array", items: { type: "string" }, description: "Facet fields to aggregate on" },
            top: { type: "integer", description: "Max results to return (default 10)", default: 10 },
            skip: { type: "integer", description: "Results to skip for pagination" },
            count: { type: "boolean", description: "Include total match count (default true)", default: true },
          },
          required: ["search"],
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

      case "search_indicators":
        result = await postData360("/data360/portal/v1/public_data360_search", {
          site: "data360",
          query_string: args.query,
          types: [args.type || "indicator"],
          data_classification: ["public"],
          skip: args.skip || 0,
          items_per_page: args.items_per_page || 10,
        });
        break;

      case "get_data":
        result = await getData360("/data360/data", {
          DATABASE_ID: args.database_id,
          INDICATOR: args.indicator_id,
          // Data API expects comma-separated REF_AREA; accept ';' too.
          REF_AREA: args.ref_area ? String(args.ref_area).replace(/;/g, ",") : undefined,
          TIME_PERIOD: args.time_period,
          timePeriodFrom: args.time_from,
          timePeriodTo: args.time_to,
          SEX: args.sex,
          AGE: args.age,
          URBANISATION: args.urbanisation,
          FREQ: args.freq,
          UNIT_MEASURE: args.unit_measure,
          UNIT_TYPE: args.unit_type,
          UNIT_MULT: args.unit_mult,
          COMP_BREAKDOWN_1: args.comp_breakdown_1,
          COMP_BREAKDOWN_2: args.comp_breakdown_2,
          COMP_BREAKDOWN_3: args.comp_breakdown_3,
          skip: args.skip,
        });
        break;

      case "list_indicators":
        result = await getData360("/data360/indicators", {
          datasetId: args.database_id,
        });
        break;

      case "get_metadata": {
        const query = `series_description/idno eq '${args.indicator_id}'`;
        const body = { query };
        if (Array.isArray(args.select_fields) && args.select_fields.length > 0) {
          body.select = args.select_fields.map((f) => `series_description/${f}`).join(", ");
        }
        result = await postData360("/data360/metadata", body);
        break;
      }

      case "get_dimensions":
        result = await postData360("/data360/portal/v1/dimensions", {
          database_id: args.database_id,
          indicator_id: args.indicator_id,
        });
        break;

      case "get_disaggregation":
        result = await getData360("/data360/disaggregation", {
          datasetId: args.database_id,
          indicatorId: args.indicator_id,
        });
        break;

      case "search":
        result = await postData360("/data360/searchv2", {
          search: args.search,
          filter: args.filter,
          orderby: args.orderby,
          select: args.select,
          searchFields: args.searchFields,
          facets: args.facets,
          top: args.top || 10,
          skip: args.skip,
          count: args.count !== undefined ? args.count : true,
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

// --- START ---
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("World Bank Data360 MCP Server v1.0.0 running on stdio (public API, no auth)");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
