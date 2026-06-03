/**
 * FEWS NET FDW API MCP Server
 *
 * REQUIREMENTS:
 * 1. Create a .env file in the same folder (or parent) containing:
 *    FEWSNET_USERNAME=your_username
 *    FEWSNET_PASSWORD=your_password
 * 2. Run 'node server.js'
 *
 * Register at https://fdw.fews.net to obtain credentials.
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

const FEWSNET_USERNAME = process.env.FEWSNET_USERNAME;
const FEWSNET_PASSWORD = process.env.FEWSNET_PASSWORD;
const BASE_URL = "https://fdw.fews.net";

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
    execSync("npm install @modelcontextprotocol/sdk axios", { stdio: "inherit" });
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
  { name: "fewsnet-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

async function callFewsNetApi(endpoint, params = {}) {
  if (!FEWSNET_USERNAME || !FEWSNET_PASSWORD) {
    throw new Error("ERROR: Credentials not found. Set FEWSNET_USERNAME and FEWSNET_PASSWORD in your .env file.");
  }
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
  );
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: cleanParams,
      auth: {
        username: FEWSNET_USERNAME,
        password: FEWSNET_PASSWORD,
      },
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

// --- TOOL DEFINITIONS ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [

      // ── SEARCH ──────────────────────────────────────────────────────────────
      {
        name: "search_fewsnet",
        description: "Project-wide faceted search across all FEWS NET data (countries, markets, indicators, documents, etc.). (Docs: /api/search/)",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Search query term" },
            page_size: { type: "integer", description: "Number of results per page (default 20)", default: 20 },
            offset: { type: "integer", description: "Pagination offset" },
          },
          required: ["q"],
        },
      },

      // ── IPC FOOD SECURITY CLASSIFICATIONS ───────────────────────────────────
      {
        name: "get_ipc_phases",
        description: "Get IPC acute food insecurity phase classification data points by country, geographic unit, date range, or scenario. This is the core FEWS NET food security output. (Docs: /api/ipcphase/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code (e.g. KE, ET, SO)" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date filter (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date filter (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date for latest available data (YYYY-MM-DD)" },
            scenario: { type: "string", description: "IPC scenario: CS (Current Situation), ML1 (Most Likely Near-Term), ML2 (Most Likely Medium-Term)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            geographic_unit_code: { type: "string", description: "Geographic unit code" },
            geographic_unit_name: { type: "string", description: "Geographic unit name" },
            geographic_unit_type: { type: "string", description: "Geographic unit type" },
            classification_scale: { type: "string", description: "IPC classification scale: IPC20, IPC30, IPC31" },
            show_ipc_only: { type: "boolean", description: "Show data only from IPC 2.0+ scale" },
            indicator: { type: "string", description: "Indicator abbreviation" },
            page_size: { type: "integer", description: "Results per page (default 20)", default: 20 },
            offset: { type: "integer", description: "Pagination offset" },
          },
        },
      },
      {
        name: "get_ipc_package",
        description: "Get a complete IPC package — the full set of IPC phase classifications for a country/period including all geographic levels. (Docs: /api/ipcpackage/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code (e.g. KE, ET)" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            scenario: { type: "string", description: "Scenario: CS, ML1, ML2" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            classification_scale: { type: "string", description: "IPC classification scale: IPC20, IPC30, IPC31" },
            show_ipc_only: { type: "boolean", description: "Show data only from IPC 2.0+ scale" },
            preference: { type: "string", description: "Use 'best' to return the best available data" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_ipc_classifications",
        description: "List IPC classification data series (metadata about classification exercises, not the data values themselves). (Docs: /api/ipcclassification/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Classification period start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "Classification period end date (YYYY-MM-DD)" },
            scenario: { type: "string", description: "Scenario: CS, ML1, ML2" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            classification_scale: { type: "string", description: "IPC scale: IPC20, IPC30, IPC31" },
            show_ipc_only: { type: "boolean", description: "Filter to IPC 2.0+ only" },
            is_active: { type: "boolean", description: "Only active classifications" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_ipc_classification_datasets",
        description: "List IPC classification dataset metadata (collection dates, visibility, domain). (Docs: /api/ipcclassificationdataset/)",
        inputSchema: {
          type: "object",
          properties: {
            start_after: { type: "string", description: "Dataset starts after (YYYY-MM-DD)" },
            start_before: { type: "string", description: "Dataset starts before (YYYY-MM-DD)" },
            end_after: { type: "string", description: "Dataset ends after (YYYY-MM-DD)" },
            end_before: { type: "string", description: "Dataset ends before (YYYY-MM-DD)" },
            visibility: { type: "string", description: "Dataset visibility filter" },
            owner: { type: "string", description: "Owner username" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── IPC POPULATION ───────────────────────────────────────────────────────
      {
        name: "get_ipc_population",
        description: "List acutely food insecure population estimate data series (metadata) by country, phase, or scenario. (Docs: /api/ipcpopulation/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            phase: { type: "string", description: "IPC phase level: 1, 2, 3, 4, 5" },
            scenario: { type: "string", description: "Scenario: CS, ML1, ML2" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            is_active: { type: "boolean", description: "Only active data series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_ipc_population_sizes",
        description: "Get acutely food insecure population size estimates (actual values) by IPC phase, country, date range, and scenario. (Docs: /api/ipcpopulationsize/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            scenario: { type: "string", description: "Scenario: CS, ML1, ML2" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            geographic_unit_code: { type: "string", description: "Geographic unit code" },
            geographic_unit_name: { type: "string", description: "Geographic unit name" },
            indicator: { type: "string", description: "Indicator abbreviation (e.g. population phase 3+)" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── HUMANITARIAN FOOD ASSISTANCE ─────────────────────────────────────────
      {
        name: "get_humanitarian_food_assistance",
        description: "List Humanitarian Food Assistance (HFA) data series — food aid pipeline and delivery information by country. (Docs: /api/ipchfa/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_humanitarian_food_assistance_values",
        description: "Get Humanitarian Food Assistance (HFA) data point values — actual food aid quantities by geographic unit and period. (Docs: /api/ipchfavalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            geographic_unit_code: { type: "string", description: "Geographic unit code" },
            indicator: { type: "string", description: "Indicator abbreviation" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── MARKET PRICES ────────────────────────────────────────────────────────
      {
        name: "get_markets",
        description: "List food markets monitored by FEWS NET with location, country, and market type information. (Docs: /api/market/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            name: { type: "string", description: "Market name filter" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_market_products",
        description: "List commodities/products monitored in FEWS NET markets. (Docs: /api/marketproduct/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            search: { type: "string", description: "Search by product name" },
            page_size: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_market_price_series",
        description: "List market price data series (metadata: which commodity at which market). (Docs: /api/marketprice/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            market: { type: "string", description: "Market ID or name" },
            product: { type: "string", description: "Product/commodity name or ID" },
            currency: { type: "string", description: "Currency ISO code (e.g. KES, ETB)" },
            unit: { type: "string", description: "Unit of measure abbreviation" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_market_price_facts",
        description: "Get market price data point values — actual observed prices for commodities at markets over time. (Docs: /api/marketpricefacts/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            market: { type: "string", description: "Market ID" },
            product: { type: "string", description: "Product/commodity ID" },
            currency: { type: "string", description: "Currency ISO code" },
            unit: { type: "string", description: "Unit of measure abbreviation" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_price_datasets",
        description: "List price dataset metadata (collection details, date ranges). (Docs: /api/pricedataset/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── PRICE INDICES & RATIOS ───────────────────────────────────────────────
      {
        name: "get_price_indices",
        description: "List secondary price index data series (e.g. terms of trade, wage-to-price ratios). (Docs: /api/priceindex/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_price_index_values",
        description: "Get secondary price index values over time (e.g. wage-to-staple price ratios). (Docs: /api/priceindexvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_calculated_price_indices",
        description: "List calculated price index data series (composite price indices derived from market prices). (Docs: /api/calculatedpriceindex/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_calculated_price_index_values",
        description: "Get calculated price index values over time (composite indices). (Docs: /api/calculatedpriceindexvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_price_ratios",
        description: "List calculated price ratio data series (e.g. cereal-to-livestock ratios). (Docs: /api/priceratio/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_price_ratio_values",
        description: "Get price ratio values over time (e.g. cereal-to-livestock trade ratios). (Docs: /api/priceratiovalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── EXCHANGE RATES ───────────────────────────────────────────────────────
      {
        name: "get_exchange_rates",
        description: "List exchange rate data series (currency pairs tracked by FEWS NET per country). (Docs: /api/exchangerate/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            currency: { type: "string", description: "Currency ISO 4217 code (e.g. KES, ETB, USD)" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_exchange_rate_values",
        description: "Get exchange rate values over time for FEWS NET–monitored currencies. (Docs: /api/exchangeratevalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            currency: { type: "string", description: "Currency ISO code" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── CROP PRODUCTION ──────────────────────────────────────────────────────
      {
        name: "get_crop_production_datasets",
        description: "List crop production estimate datasets (metadata for production surveys). (Docs: /api/cropproductiondataset/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_crop_production_indicators",
        description: "List crop production estimate indicator data series (e.g. harvest estimates by crop and area). (Docs: /api/cropproductionindicator/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            product: { type: "string", description: "Crop/product ID or name" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_crop_production_values",
        description: "Get crop production estimate values — actual harvest/production quantities by geographic unit and season. (Docs: /api/cropproductionindicatorvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            geographic_unit_name: { type: "string", description: "Geographic unit name" },
            product: { type: "string", description: "Crop/product filter" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_crop_yield_forecast_indicators",
        description: "List crop yield forecast data series (predictive yield models by crop and region). (Docs: /api/cropyieldforecastindicator/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_crop_yield_forecast_values",
        description: "Get crop yield forecast values (projected yield quantities by area and crop). (Docs: /api/cropyieldforecastindicatorvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── NUTRITION ────────────────────────────────────────────────────────────
      {
        name: "get_nutrition_datasets",
        description: "List nutrition survey datasets (SMART surveys, MICS, DHS nutrition components). (Docs: /api/nutritiondataset/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_nutrition_indicators",
        description: "List nutrition indicator data series (e.g. GAM, SAM rates by area). (Docs: /api/nutritionindicator/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_nutrition_indicator_values",
        description: "Get nutrition indicator values — acute malnutrition rates (GAM, SAM) and other nutrition metrics over time. (Docs: /api/nutritionindicatorvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            geographic_unit_name: { type: "string", description: "Geographic unit name" },
            indicator: { type: "string", description: "Indicator abbreviation (e.g. GAM, SAM)" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── POPULATION ───────────────────────────────────────────────────────────
      {
        name: "get_population_datasets",
        description: "List population estimate and census datasets. (Docs: /api/populationdataset/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_population_indicators",
        description: "List population estimate and census indicator data series by geographic unit. (Docs: /api/populationindicator/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_population_indicator_values",
        description: "Get population estimate values — population counts and projections by geographic unit over time. (Docs: /api/populationindicatorvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            geographic_unit_name: { type: "string", description: "Geographic unit name" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── HUMANITARIAN RESPONSE ────────────────────────────────────────────────
      {
        name: "get_response_datasets",
        description: "List humanitarian response datasets (food aid, cash transfers, etc.). (Docs: /api/responsedataset/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_responses",
        description: "List humanitarian response data series — food assistance programs and interventions by area. (Docs: /api/response/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_response_values",
        description: "Get humanitarian response values — quantities/beneficiaries for food assistance programs by period and area. (Docs: /api/responsevalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            indicator: { type: "string", description: "Response indicator abbreviation" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── TRADE FLOWS ──────────────────────────────────────────────────────────
      {
        name: "get_trade_flow_datasets",
        description: "List trade flow datasets (cross-border food commodity trade monitoring). (Docs: /api/tradeflowdataset/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_trade_flow_quantities",
        description: "List trade flow quantity data series (commodity flows between areas). (Docs: /api/tradeflowquantity/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            product: { type: "string", description: "Commodity/product filter" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_trade_flow_quantity_values",
        description: "Get trade flow quantity values — actual cross-border commodity trade volumes by period and route. (Docs: /api/tradeflowquantityvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            product: { type: "string", description: "Commodity/product filter" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── GEOGRAPHIC REFERENCE DATA ────────────────────────────────────────────
      {
        name: "get_countries",
        description: "List all countries tracked by FEWS NET with ISO codes, names, and metadata. (Docs: /api/country/)",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Filter by country name" },
            iso3166a2: { type: "string", description: "Filter by ISO 3166-1 alpha-2 code (e.g. KE)" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_country_groups",
        description: "List country groups / regional groupings (e.g. IGAD, SADC, West Africa). (Docs: /api/countrygroup/)",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Filter by group name" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_geographic_units",
        description: "List FEWS NET geographic units (admin zones, livelihood zones, etc.) with FNID codes. (Docs: /api/geographicunit/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            name: { type: "string", description: "Geographic unit name" },
            admin_level: { type: "integer", description: "Administrative level (0=country, 1=admin1, 2=admin2)" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_geographic_unit_sets",
        description: "List geographic unit sets — versioned administrative boundary sets used in FEWS NET data. (Docs: /api/geographicunitset/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── REFERENCE / LOOKUP DATA ──────────────────────────────────────────────
      {
        name: "get_classified_products",
        description: "List CPC v2–classified food commodities and products tracked by FEWS NET. (Docs: /api/classifiedproduct/)",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Filter by product name" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_currencies",
        description: "List currencies tracked by FEWS NET with ISO 4217 codes. (Docs: /api/currency/)",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Filter by currency name" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_units_of_measure",
        description: "List units of measure used in FEWS NET data (kg, MT, litres, etc.). (Docs: /api/unitofmeasure/)",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Filter by unit name" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_scenarios",
        description: "List IPC projection scenarios (CS=Current Situation, ML1=Near-Term Projection, ML2=Medium-Term Projection). (Docs: /api/scenario/)",
        inputSchema: {
          type: "object",
          properties: {
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_seasons",
        description: "List agricultural seasons tracked by FEWS NET by country. (Docs: /api/season/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_indicators",
        description: "List all FEWS NET indicators (food security, market, nutrition, population metrics). (Docs: /api/indicator/)",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Filter by indicator name" },
            group: { type: "string", description: "Indicator group filter" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },

      // ── ASSUMPTIONS / NARRATIVE ──────────────────────────────────────────────
      {
        name: "get_assumptions_reports",
        description: "List FEWS NET assumptions reports — analytical narratives underpinning food security projections. (Docs: /api/assumptions/report/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_assumptions_report_items",
        description: "List individual items/findings within FEWS NET assumptions reports. (Docs: /api/assumptions/reportitem/)",
        inputSchema: {
          type: "object",
          properties: {
            report: { type: "integer", description: "Filter by report ID" },
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_narrative_metadata",
        description: "List FEWS NET narrative metadata — food security outlook reports and situational narratives. (Docs: /api/narrativemetadata/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            document_type: { type: "string", description: "Document type filter" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_source_documents",
        description: "List data source documents referenced in FEWS NET datasets (surveys, reports, bulletins). (Docs: /api/datasourcedocument/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            document_type: { type: "string", description: "Document type filter" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── COMMODITY BALANCE ────────────────────────────────────────────────────
      {
        name: "get_commodity_balances",
        description: "List commodity balance data series — national/regional food balance sheet data. (Docs: /api/commoditybalance/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_commodity_balance_facts",
        description: "Get commodity balance data points — food production, imports, exports, and utilization values. (Docs: /api/commoditybalancefacts/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── SURVEYS ──────────────────────────────────────────────────────────────
      {
        name: "get_surveys",
        description: "List household surveys used by FEWS NET (food security, livelihood, and nutrition surveys). (Docs: /api/survey/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_survey_indicators",
        description: "List survey indicator data series metadata (indicator definitions used in household surveys). (Docs: /api/surveyindicator/)",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_survey_indicator_values",
        description: "Get survey indicator values from household surveys (food security, livelihood indicators by survey period). (Docs: /api/surveyindicatorvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            indicator: { type: "string", description: "Indicator abbreviation" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── IPC PHASE MAPS ───────────────────────────────────────────────────────
      {
        name: "get_ipc_phase_maps",
        description: "Get IPC phase map data — spatial food security classification data with phase polygons by country, scenario, and date. (Docs: /api/ipcphasemap/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            scenario: { type: "string", description: "Scenario: CS, ML1, ML2" },
            period_date: { type: "string", description: "Period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            classification_scale: { type: "string", description: "IPC scale: IPC20, IPC30, IPC31, CH, FNFIS" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── RAINFALL ESTIMATES ───────────────────────────────────────────────────
      {
        name: "get_rainfall_estimates",
        description: "List rainfall estimate data series — precipitation monitoring series by country and geographic unit. (Docs: /api/rainfallestimates/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_rainfall_estimate_values",
        description: "Get rainfall estimate values — observed precipitation amounts by geographic unit and date. (Docs: /api/rainfallestimatesvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── DISPLACEMENT TRACKING ────────────────────────────────────────────────
      {
        name: "get_displacement_tracking",
        description: "List displacement tracking data series — IDP and refugee movement monitoring by country. (Docs: /api/displacementtracking/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_displacement_tracking_values",
        description: "Get displacement tracking values — IDP/refugee population counts by area and date. (Docs: /api/displacementtrackingvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── MIGRATION FLOWS ──────────────────────────────────────────────────────
      {
        name: "get_migration_flows",
        description: "List migration flow data series — cross-border and internal population movement series. (Docs: /api/migrationflow/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_migration_flow_values",
        description: "Get migration flow values — population movement quantities by route and date. (Docs: /api/migrationflowvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── HEAT EXPOSURE ────────────────────────────────────────────────────────
      {
        name: "get_heat_exposure",
        description: "List heat exposure data series — climate heat stress monitoring series by country and area. (Docs: /api/heatexposure/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_heat_exposure_values",
        description: "Get heat exposure values — heat stress metrics by area and date. (Docs: /api/heatexposurevalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── HEAT-RELATED EXTREMES ────────────────────────────────────────────────
      {
        name: "get_heat_related_extremes",
        description: "List heat-related extremes data series — extreme heat event monitoring by country. (Docs: /api/heatrelatedextremes/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_heat_related_extremes_values",
        description: "Get heat-related extremes values — extreme heat event metrics by area and date. (Docs: /api/heatrelatedextremesvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── MARKET FUNCTION ──────────────────────────────────────────────────────
      {
        name: "get_market_functions",
        description: "List market functionality assessment data series — market operation status by area. (Docs: /api/marketfunction/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_market_function_values",
        description: "Get market functionality values — market operation status scores by area and date. (Docs: /api/marketfunctionvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── LABOR ────────────────────────────────────────────────────────────────
      {
        name: "get_labor_data",
        description: "List labor market data series — wage rates and employment indicator series by country. (Docs: /api/labor/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_labor_values",
        description: "Get labor market values — wage rates and employment figures by area and date. (Docs: /api/laborvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── DAYS WORK AVAILABLE ──────────────────────────────────────────────────
      {
        name: "get_days_work_available",
        description: "List days of work available data series — agricultural and casual labor availability by country. (Docs: /api/daysworkavailable/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_days_work_available_values",
        description: "Get days of work available values — labor availability counts by area and date. (Docs: /api/daysworkavailablevalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── ECONOMIC STATISTICS ──────────────────────────────────────────────────
      {
        name: "get_economic_statistics",
        description: "List economic statistics data series — macroeconomic indicators (inflation, GDP, etc.) by country. (Docs: /api/economicstatistics/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_economic_statistics_values",
        description: "Get economic statistics values — macroeconomic indicator readings by country and date. (Docs: /api/economicstatisticsvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── REMITTANCES ──────────────────────────────────────────────────────────
      {
        name: "get_remittances",
        description: "List remittances data series — international money transfer flow monitoring by country. (Docs: /api/remittances/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_remittances_values",
        description: "Get remittances values — money transfer volumes by country and date. (Docs: /api/remittancesvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── TRADE ROUTE ACCESS ───────────────────────────────────────────────────
      {
        name: "get_trade_route_access",
        description: "List trade route access data series — road and border crossing functionality assessments. (Docs: /api/traderouteaccess/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_trade_route_access_values",
        description: "Get trade route access values — road/crossing functionality scores by route and date. (Docs: /api/traderouteaccessvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── POPULATION PROJECTIONS ───────────────────────────────────────────────
      {
        name: "get_population_projections",
        description: "List population projection data series — demographic forecast series by country and area. (Docs: /api/populationprojection/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            is_active: { type: "boolean", description: "Only active series" },
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_population_projection_values",
        description: "Get population projection values — projected population counts by area and future date. (Docs: /api/populationprojectionvalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── EFA PEAK NEEDS & ACAPS ───────────────────────────────────────────────
      {
        name: "get_efa_peak_needs",
        description: "Get Emergency Food Assistance (EFA) peak needs data — COVID-19 era peak humanitarian food assistance requirements. (Docs: /api/efapeakneeds/)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_acaps_data",
        description: "Get ACAPS humanitarian situation data — crisis severity and access data from ACAPS (originally COVID-19 context). (Docs: /api/acaps/)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },

      // ── IPC POPULATION DATASET ───────────────────────────────────────────────
      {
        name: "get_ipc_population_datasets",
        description: "List IPC population dataset metadata — dataset collection details for food insecure population estimates. (Docs: /api/ipcpopulationdataset/)",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── COMMODITY BALANCE DATASET ────────────────────────────────────────────
      {
        name: "get_commodity_balance_datasets",
        description: "List commodity balance dataset metadata — food balance sheet dataset details. (Docs: /api/commoditybalancedataset/)",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_commodity_balance_values",
        description: "Get commodity balance values — food production, import, export, and utilization data points. (Docs: /api/commoditybalancevalue/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── CROP PRODUCTION FACTS ────────────────────────────────────────────────
      {
        name: "get_crop_production_facts",
        description: "Get crop production estimate fact data points — harvest quantities with associated statistics by area and season. (Docs: /api/cropproductionfacts/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            admin_level: { type: "string", description: "Admin level filter" },
            product: { type: "string", description: "Crop/product filter" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── GEOGRAPHIC REFERENCE ─────────────────────────────────────────────────
      {
        name: "get_common_geographic_units",
        description: "List common geographic units — cross-version harmonized geographic unit references. (Docs: /api/commongeographicunit/)",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_geographic_unit_types",
        description: "List geographic unit types — admin level and unit type definitions (admin1, livelihood zone, etc.). (Docs: /api/geographicunittype/)",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_geographic_unit_tree",
        description: "List geographic unit hierarchy tree — parent-child relationships between administrative units. (Docs: /api/geographicunittree/)",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_geographic_unit_relationships",
        description: "List geographic unit relationships — overlap and containment relationships between geographic units. (Docs: /api/geographicunitrelationship/)",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_geographic_unit_set_versions",
        description: "List geographic unit set versions — versioned boundary sets and their validity periods. (Docs: /api/geographicunitsetversion/)",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── ALTERNATIVE FACTS ENDPOINTS ──────────────────────────────────────────
      {
        name: "get_calculated_price_index_value_facts",
        description: "Get calculated price index value facts — composite price index data points with associated statistics. (Docs: /api/calculatedpriceindexvaluefacts/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_exchange_rate_value_facts",
        description: "Get exchange rate value facts — currency exchange rate data points with associated statistics. (Docs: /api/exchangeratevaluefacts/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            country: { type: "string", description: "Country name or ID" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            currency: { type: "string", description: "Currency ISO code" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_price_index_value_facts",
        description: "Get price index value facts — secondary price index data points with associated statistics. (Docs: /api/priceindexvaluefacts/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_price_ratio_value_facts",
        description: "Get price ratio value facts — cereal-to-livestock and other price ratio data points with statistics. (Docs: /api/priceratiovaluefacts/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_trade_flow_quantity_value_facts",
        description: "Get trade flow quantity value facts — cross-border commodity trade data points with statistics. (Docs: /api/tradeflowquantityvaluefacts/)",
        inputSchema: {
          type: "object",
          properties: {
            country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
            period_date: { type: "string", description: "Specific period date (YYYY-MM-DD)" },
            as_of_date: { type: "string", description: "As-of date (YYYY-MM-DD)" },
            fnid: { type: "string", description: "FEWS NET geographic unit code" },
            product: { type: "string", description: "Commodity/product filter" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── INDICATOR & NARRATIVE REFERENCE ─────────────────────────────────────
      {
        name: "get_indicator_groups",
        description: "List indicator groups — categories that group related FEWS NET indicators together. (Docs: /api/indicatorgroup/)",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search term" },
          },
        },
      },
      {
        name: "get_narrative_metadata_types",
        description: "List narrative metadata types — document type definitions for FEWS NET reports and bulletins. (Docs: /api/narrativemetadatatype/)",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_document_types",
        description: "List document types — reference list of document type codes used across FEWS NET datasets. (Docs: /api/documenttype/)",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_data_source_organizations",
        description: "List data source organizations — partner organizations and agencies that supply data to FEWS NET. (Docs: /api/datasourceorganization/)",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search term" },
            page_size: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
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

      // SEARCH
      case "search_fewsnet":
        result = await callFewsNetApi("/api/search/", {
          q: args.q,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // IPC FOOD SECURITY CLASSIFICATIONS
      case "get_ipc_phases":
        result = await callFewsNetApi("/api/ipcphase/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          scenario: args.scenario,
          fnid: args.fnid,
          geographic_unit_code: args.geographic_unit_code,
          geographic_unit_name: args.geographic_unit_name,
          geographic_unit_type: args.geographic_unit_type,
          classification_scale: args.classification_scale,
          show_ipc_only: args.show_ipc_only,
          indicator: args.indicator,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_ipc_package":
        result = await callFewsNetApi("/api/ipcpackage/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          scenario: args.scenario,
          fnid: args.fnid,
          classification_scale: args.classification_scale,
          show_ipc_only: args.show_ipc_only,
          preference: args.preference,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_ipc_classifications":
        result = await callFewsNetApi("/api/ipcclassification/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          scenario: args.scenario,
          fnid: args.fnid,
          classification_scale: args.classification_scale,
          show_ipc_only: args.show_ipc_only,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_ipc_classification_datasets":
        result = await callFewsNetApi("/api/ipcclassificationdataset/", {
          start_after: args.start_after,
          start_before: args.start_before,
          end_after: args.end_after,
          end_before: args.end_before,
          visibility: args.visibility,
          owner: args.owner,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // IPC POPULATION
      case "get_ipc_population":
        result = await callFewsNetApi("/api/ipcpopulation/", {
          country_code: args.country_code,
          country: args.country,
          phase: args.phase,
          scenario: args.scenario,
          fnid: args.fnid,
          start_date: args.start_date,
          end_date: args.end_date,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_ipc_population_sizes":
        result = await callFewsNetApi("/api/ipcpopulationsize/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          scenario: args.scenario,
          fnid: args.fnid,
          geographic_unit_code: args.geographic_unit_code,
          geographic_unit_name: args.geographic_unit_name,
          indicator: args.indicator,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // HUMANITARIAN FOOD ASSISTANCE
      case "get_humanitarian_food_assistance":
        result = await callFewsNetApi("/api/ipchfa/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          fnid: args.fnid,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_humanitarian_food_assistance_values":
        result = await callFewsNetApi("/api/ipchfavalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          fnid: args.fnid,
          geographic_unit_code: args.geographic_unit_code,
          indicator: args.indicator,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // MARKET PRICES
      case "get_markets":
        result = await callFewsNetApi("/api/market/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          name: args.name,
          search: args.search,
          page_size: args.page_size || 50,
          offset: args.offset,
        });
        break;

      case "get_market_products":
        result = await callFewsNetApi("/api/marketproduct/", {
          country_code: args.country_code,
          search: args.search,
          page_size: args.page_size || 50,
          offset: args.offset,
        });
        break;

      case "get_market_price_series":
        result = await callFewsNetApi("/api/marketprice/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          market: args.market,
          product: args.product,
          currency: args.currency,
          unit: args.unit,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_market_price_facts":
        result = await callFewsNetApi("/api/marketpricefacts/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          fnid: args.fnid,
          market: args.market,
          product: args.product,
          currency: args.currency,
          unit: args.unit,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_price_datasets":
        result = await callFewsNetApi("/api/pricedataset/", {
          country_code: args.country_code,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // PRICE INDICES & RATIOS
      case "get_price_indices":
        result = await callFewsNetApi("/api/priceindex/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_price_index_values":
        result = await callFewsNetApi("/api/priceindexvalue/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_calculated_price_indices":
        result = await callFewsNetApi("/api/calculatedpriceindex/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_calculated_price_index_values":
        result = await callFewsNetApi("/api/calculatedpriceindexvalue/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_price_ratios":
        result = await callFewsNetApi("/api/priceratio/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_price_ratio_values":
        result = await callFewsNetApi("/api/priceratiovalue/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // EXCHANGE RATES
      case "get_exchange_rates":
        result = await callFewsNetApi("/api/exchangerate/", {
          country_code: args.country_code,
          country: args.country,
          currency: args.currency,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_exchange_rate_values":
        result = await callFewsNetApi("/api/exchangeratevalue/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          currency: args.currency,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // CROP PRODUCTION
      case "get_crop_production_datasets":
        result = await callFewsNetApi("/api/cropproductiondataset/", {
          country_code: args.country_code,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_crop_production_indicators":
        result = await callFewsNetApi("/api/cropproductionindicator/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          product: args.product,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_crop_production_values":
        result = await callFewsNetApi("/api/cropproductionindicatorvalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          fnid: args.fnid,
          geographic_unit_name: args.geographic_unit_name,
          product: args.product,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_crop_yield_forecast_indicators":
        result = await callFewsNetApi("/api/cropyieldforecastindicator/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_crop_yield_forecast_values":
        result = await callFewsNetApi("/api/cropyieldforecastindicatorvalue/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // NUTRITION
      case "get_nutrition_datasets":
        result = await callFewsNetApi("/api/nutritiondataset/", {
          country_code: args.country_code,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_nutrition_indicators":
        result = await callFewsNetApi("/api/nutritionindicator/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_nutrition_indicator_values":
        result = await callFewsNetApi("/api/nutritionindicatorvalue/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          fnid: args.fnid,
          geographic_unit_name: args.geographic_unit_name,
          indicator: args.indicator,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // POPULATION
      case "get_population_datasets":
        result = await callFewsNetApi("/api/populationdataset/", {
          country_code: args.country_code,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_population_indicators":
        result = await callFewsNetApi("/api/populationindicator/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_population_indicator_values":
        result = await callFewsNetApi("/api/populationindicatorvalue/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          fnid: args.fnid,
          geographic_unit_name: args.geographic_unit_name,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // HUMANITARIAN RESPONSE
      case "get_response_datasets":
        result = await callFewsNetApi("/api/responsedataset/", {
          country_code: args.country_code,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_responses":
        result = await callFewsNetApi("/api/response/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_response_values":
        result = await callFewsNetApi("/api/responsevalue/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          fnid: args.fnid,
          indicator: args.indicator,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // TRADE FLOWS
      case "get_trade_flow_datasets":
        result = await callFewsNetApi("/api/tradeflowdataset/", {
          country_code: args.country_code,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_trade_flow_quantities":
        result = await callFewsNetApi("/api/tradeflowquantity/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          product: args.product,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_trade_flow_quantity_values":
        result = await callFewsNetApi("/api/tradeflowquantityvalue/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          fnid: args.fnid,
          product: args.product,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // GEOGRAPHIC REFERENCE
      case "get_countries":
        result = await callFewsNetApi("/api/country/", {
          name: args.name,
          iso3166a2: args.iso3166a2,
          search: args.search,
          page_size: args.page_size || 50,
          offset: args.offset,
        });
        break;

      case "get_country_groups":
        result = await callFewsNetApi("/api/countrygroup/", {
          name: args.name,
          search: args.search,
          page_size: args.page_size || 50,
          offset: args.offset,
        });
        break;

      case "get_geographic_units":
        result = await callFewsNetApi("/api/geographicunit/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          name: args.name,
          admin_level: args.admin_level,
          search: args.search,
          page_size: args.page_size || 50,
          offset: args.offset,
        });
        break;

      case "get_geographic_unit_sets":
        result = await callFewsNetApi("/api/geographicunitset/", {
          country_code: args.country_code,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // REFERENCE / LOOKUP
      case "get_classified_products":
        result = await callFewsNetApi("/api/classifiedproduct/", {
          name: args.name,
          search: args.search,
          page_size: args.page_size || 50,
          offset: args.offset,
        });
        break;

      case "get_currencies":
        result = await callFewsNetApi("/api/currency/", {
          name: args.name,
          search: args.search,
          page_size: args.page_size || 50,
          offset: args.offset,
        });
        break;

      case "get_units_of_measure":
        result = await callFewsNetApi("/api/unitofmeasure/", {
          name: args.name,
          search: args.search,
          page_size: args.page_size || 50,
          offset: args.offset,
        });
        break;

      case "get_scenarios":
        result = await callFewsNetApi("/api/scenario/", {
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_seasons":
        result = await callFewsNetApi("/api/season/", {
          country_code: args.country_code,
          search: args.search,
          page_size: args.page_size || 50,
          offset: args.offset,
        });
        break;

      case "get_indicators":
        result = await callFewsNetApi("/api/indicator/", {
          name: args.name,
          group: args.group,
          search: args.search,
          page_size: args.page_size || 50,
          offset: args.offset,
        });
        break;

      // ASSUMPTIONS / NARRATIVE
      case "get_assumptions_reports":
        result = await callFewsNetApi("/api/assumptions/report/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_assumptions_report_items":
        result = await callFewsNetApi("/api/assumptions/reportitem/", {
          report: args.report,
          country_code: args.country_code,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_narrative_metadata":
        result = await callFewsNetApi("/api/narrativemetadata/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          document_type: args.document_type,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_source_documents":
        result = await callFewsNetApi("/api/datasourcedocument/", {
          country_code: args.country_code,
          document_type: args.document_type,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // COMMODITY BALANCE
      case "get_commodity_balances":
        result = await callFewsNetApi("/api/commoditybalance/", {
          country_code: args.country_code,
          country: args.country,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_commodity_balance_facts":
        result = await callFewsNetApi("/api/commoditybalancefacts/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // SURVEYS
      case "get_surveys":
        result = await callFewsNetApi("/api/survey/", {
          country_code: args.country_code,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_survey_indicators":
        result = await callFewsNetApi("/api/surveyindicator/", {
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_survey_indicator_values":
        result = await callFewsNetApi("/api/surveyindicatorvalue/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          fnid: args.fnid,
          indicator: args.indicator,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // IPC PHASE MAPS
      case "get_ipc_phase_maps":
        result = await callFewsNetApi("/api/ipcphasemap/", {
          country_code: args.country_code,
          scenario: args.scenario,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          classification_scale: args.classification_scale,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // RAINFALL ESTIMATES
      case "get_rainfall_estimates":
        result = await callFewsNetApi("/api/rainfallestimates/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_rainfall_estimate_values":
        result = await callFewsNetApi("/api/rainfallestimatesvalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // DISPLACEMENT TRACKING
      case "get_displacement_tracking":
        result = await callFewsNetApi("/api/displacementtracking/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_displacement_tracking_values":
        result = await callFewsNetApi("/api/displacementtrackingvalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // MIGRATION FLOWS
      case "get_migration_flows":
        result = await callFewsNetApi("/api/migrationflow/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_migration_flow_values":
        result = await callFewsNetApi("/api/migrationflowvalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // HEAT EXPOSURE
      case "get_heat_exposure":
        result = await callFewsNetApi("/api/heatexposure/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_heat_exposure_values":
        result = await callFewsNetApi("/api/heatexposurevalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // HEAT-RELATED EXTREMES
      case "get_heat_related_extremes":
        result = await callFewsNetApi("/api/heatrelatedextremes/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_heat_related_extremes_values":
        result = await callFewsNetApi("/api/heatrelatedextremesvalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // MARKET FUNCTION
      case "get_market_functions":
        result = await callFewsNetApi("/api/marketfunction/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_market_function_values":
        result = await callFewsNetApi("/api/marketfunctionvalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // LABOR
      case "get_labor_data":
        result = await callFewsNetApi("/api/labor/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_labor_values":
        result = await callFewsNetApi("/api/laborvalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // DAYS WORK AVAILABLE
      case "get_days_work_available":
        result = await callFewsNetApi("/api/daysworkavailable/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_days_work_available_values":
        result = await callFewsNetApi("/api/daysworkavailablevalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // ECONOMIC STATISTICS
      case "get_economic_statistics":
        result = await callFewsNetApi("/api/economicstatistics/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_economic_statistics_values":
        result = await callFewsNetApi("/api/economicstatisticsvalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // REMITTANCES
      case "get_remittances":
        result = await callFewsNetApi("/api/remittances/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_remittances_values":
        result = await callFewsNetApi("/api/remittancesvalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // TRADE ROUTE ACCESS
      case "get_trade_route_access":
        result = await callFewsNetApi("/api/traderouteaccess/", {
          country_code: args.country_code,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_trade_route_access_values":
        result = await callFewsNetApi("/api/traderouteaccessvalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // POPULATION PROJECTIONS
      case "get_population_projections":
        result = await callFewsNetApi("/api/populationprojection/", {
          country_code: args.country_code,
          country: args.country,
          fnid: args.fnid,
          is_active: args.is_active,
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_population_projection_values":
        result = await callFewsNetApi("/api/populationprojectionvalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // EFA PEAK NEEDS & ACAPS
      case "get_efa_peak_needs":
        result = await callFewsNetApi("/api/efapeakneeds/", {});
        break;

      case "get_acaps_data":
        result = await callFewsNetApi("/api/acaps/", {});
        break;

      // IPC POPULATION DATASET
      case "get_ipc_population_datasets":
        result = await callFewsNetApi("/api/ipcpopulationdataset/", {
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // COMMODITY BALANCE DATASET & VALUE
      case "get_commodity_balance_datasets":
        result = await callFewsNetApi("/api/commoditybalancedataset/", {
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_commodity_balance_values":
        result = await callFewsNetApi("/api/commoditybalancevalue/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // CROP PRODUCTION FACTS
      case "get_crop_production_facts":
        result = await callFewsNetApi("/api/cropproductionfacts/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          admin_level: args.admin_level,
          product: args.product,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // GEOGRAPHIC REFERENCE
      case "get_common_geographic_units":
        result = await callFewsNetApi("/api/commongeographicunit/", {
          search: args.search,
          page_size: args.page_size || 50,
          offset: args.offset,
        });
        break;

      case "get_geographic_unit_types":
        result = await callFewsNetApi("/api/geographicunittype/", {
          search: args.search,
          page_size: args.page_size || 50,
          offset: args.offset,
        });
        break;

      case "get_geographic_unit_tree":
        result = await callFewsNetApi("/api/geographicunittree/", {
          search: args.search,
          page_size: args.page_size || 50,
          offset: args.offset,
        });
        break;

      case "get_geographic_unit_relationships":
        result = await callFewsNetApi("/api/geographicunitrelationship/", {
          search: args.search,
          page_size: args.page_size || 50,
          offset: args.offset,
        });
        break;

      case "get_geographic_unit_set_versions":
        result = await callFewsNetApi("/api/geographicunitsetversion/", {
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // ALTERNATIVE FACTS ENDPOINTS
      case "get_calculated_price_index_value_facts":
        result = await callFewsNetApi("/api/calculatedpriceindexvaluefacts/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_exchange_rate_value_facts":
        result = await callFewsNetApi("/api/exchangeratevaluefacts/", {
          country_code: args.country_code,
          country: args.country,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          currency: args.currency,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_price_index_value_facts":
        result = await callFewsNetApi("/api/priceindexvaluefacts/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_price_ratio_value_facts":
        result = await callFewsNetApi("/api/priceratiovaluefacts/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_trade_flow_quantity_value_facts":
        result = await callFewsNetApi("/api/tradeflowquantityvaluefacts/", {
          country_code: args.country_code,
          start_date: args.start_date,
          end_date: args.end_date,
          period_date: args.period_date,
          as_of_date: args.as_of_date,
          fnid: args.fnid,
          product: args.product,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      // INDICATOR & NARRATIVE REFERENCE
      case "get_indicator_groups":
        result = await callFewsNetApi("/api/indicatorgroup/", {
          search: args.search,
        });
        break;

      case "get_narrative_metadata_types":
        result = await callFewsNetApi("/api/narrativemetadatatype/", {
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_document_types":
        result = await callFewsNetApi("/api/documenttype/", {
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
        });
        break;

      case "get_data_source_organizations":
        result = await callFewsNetApi("/api/datasourceorganization/", {
          search: args.search,
          page_size: args.page_size || 20,
          offset: args.offset,
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
  if (!FEWSNET_USERNAME || !FEWSNET_PASSWORD) {
    console.error("FATAL: Cannot start server. Missing FEWSNET_USERNAME or FEWSNET_PASSWORD in .env file.");
    console.error("Register at https://fdw.fews.net to obtain credentials.");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FEWS NET FDW MCP Server v1.0.0 running on stdio (Credentials loaded from .env)");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
