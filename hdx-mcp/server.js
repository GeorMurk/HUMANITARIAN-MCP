/**
 * HDX HAPI MCP Server
 * Humanitarian API (HAPI) — https://hapi.humdata.org/docs
 *
 * SETUP:
 * 1. Get your free app identifier by encoding your details at:
 *    https://hapi.humdata.org/docs#/Util/get_encoded_identifier_api_v1_encode_identifier_get
 * 2. Create a .env file in this folder:
 *    HDX_API_TOKEN=your_base64_encoded_identifier
 * 3. Run: node server.js
 */

const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

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

const HDX_APP_IDENTIFIER = process.env.HDX_API_TOKEN || process.env.HDX_APP_IDENTIFIER;
const BASE_URL = "https://hapi.humdata.org/api/v1";

// Auto-install dependencies if missing
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
  { name: "hdx-hapi-mcp", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

async function callHapiApi(endpoint, params = {}) {
  if (!HDX_APP_IDENTIFIER) {
    throw new Error(
      "HDX_API_TOKEN not found. Add it to your .env file. " +
      "Get yours at: https://hapi.humdata.org/docs#/Util/get_encoded_identifier_api_v1_encode_identifier_get"
    );
  }
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== "")
  );
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: {
        ...cleanParams,
        output_format: "json",
        app_identifier: HDX_APP_IDENTIFIER,
      },
      headers: { Accept: "application/json" },
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

// ─── TOOL DEFINITIONS ─────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [

      // ── METADATA ─────────────────────────────────────────────────────────────
      {
        name: "get_locations",
        description: "Get country and country-like location metadata with ISO3 codes and p-codes. (Docs: /api/v1/metadata/location)",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "ISO3 country code filter (e.g. 'AFG', 'SOM', 'SSD')" },
            name: { type: "string", description: "Location name filter (partial match)" },
            has_hrp: { type: "boolean", description: "Filter to locations with a Humanitarian Response Plan" },
            in_gho: { type: "boolean", description: "Filter to locations in the Global Humanitarian Overview" },
            limit: { type: "integer", description: "Max results (default 100)", default: 100 },
            offset: { type: "integer", description: "Pagination offset (default 0)", default: 0 },
          },
        },
      },
      {
        name: "get_admin1",
        description: "Get first-level administrative divisions (provinces, states, regions) with p-codes. (Docs: /api/v1/metadata/admin1)",
        inputSchema: {
          type: "object",
          properties: {
            location_code: { type: "string", description: "ISO3 country code filter" },
            code: { type: "string", description: "Admin1 p-code filter" },
            name: { type: "string", description: "Admin1 name filter" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_admin2",
        description: "Get second-level administrative divisions (districts, counties) with p-codes. (Docs: /api/v1/metadata/admin2)",
        inputSchema: {
          type: "object",
          properties: {
            location_code: { type: "string", description: "ISO3 country code filter" },
            admin1_code: { type: "string", description: "Admin1 p-code filter" },
            code: { type: "string", description: "Admin2 p-code filter" },
            name: { type: "string", description: "Admin2 name filter" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_datasets",
        description: "Get HDX dataset metadata including titles, providers, and links to original datasets. (Docs: /api/v1/metadata/dataset)",
        inputSchema: {
          type: "object",
          properties: {
            dataset_hdx_id: { type: "string", description: "Unique HDX dataset ID filter" },
            hdx_provider_stub: { type: "string", description: "Provider stub/slug filter" },
            title: { type: "string", description: "Dataset title filter" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_resources",
        description: "Get HDX resource metadata including format, update dates, and HXL compliance status. (Docs: /api/v1/metadata/resource)",
        inputSchema: {
          type: "object",
          properties: {
            dataset_hdx_id: { type: "string", description: "Filter by parent dataset ID" },
            resource_hdx_id: { type: "string", description: "Unique resource ID filter" },
            name: { type: "string", description: "Resource name filter" },
            format: { type: "string", description: "File format filter (e.g. 'CSV', 'XLSX')" },
            hxl_compliant: { type: "boolean", description: "Filter by HXL compliance" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_data_availability",
        description: "Check which humanitarian data categories and sub-categories are available by country and administrative level, with last update dates. (Docs: /api/v1/metadata/data_availability)",
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string", description: "Data category (e.g. 'affected-people', 'coordination-context', 'food-security-nutrition-poverty', 'population-social')" },
            subcategory: { type: "string", description: "Data subcategory (e.g. 'refugees', 'idps', 'food-security', 'funding', 'conflict-event')" },
            location_code: { type: "string", description: "ISO3 country code filter" },
            admin_level: { type: "integer", description: "Administrative level: 0=country, 1=admin1, 2=admin2" },
            limit: { type: "integer", default: 200 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_sectors",
        description: "Get humanitarian sector codes and names (e.g. Health, Education, Food Security, Shelter, WASH). (Docs: /api/v1/metadata/sector)",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "Sector code filter" },
            name: { type: "string", description: "Sector name filter" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_organizations",
        description: "Get humanitarian organizations with acronyms, names, and OCHA type classifications. (Docs: /api/v1/metadata/org)",
        inputSchema: {
          type: "object",
          properties: {
            acronym: { type: "string", description: "Organization acronym (e.g. 'UNHCR', 'WFP', 'UNICEF')" },
            name: { type: "string", description: "Organization name filter" },
            org_type_code: { type: "string", description: "Organization type code filter" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_org_types",
        description: "Get organization type classification codes and descriptions (OCHA standards). (Docs: /api/v1/metadata/org_type)",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "Org type code filter" },
            description: { type: "string", description: "Org type description filter" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_currencies",
        description: "Get ISO-4217 currency codes and names used in WFP food price data. (Docs: /api/v1/metadata/currency)",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "Currency code (e.g. 'USD', 'KES', 'ETB')" },
            name: { type: "string", description: "Currency name filter" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_wfp_commodities",
        description: "Get WFP food commodity codes, names, and category classifications. (Docs: /api/v1/metadata/wfp_commodity)",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "Commodity code filter" },
            name: { type: "string", description: "Commodity name filter" },
            category: { type: "string", description: "Commodity category (e.g. 'cereals and tubers', 'pulses and nuts')" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_wfp_markets",
        description: "Get WFP market locations with GPS coordinates and administrative hierarchy. (Docs: /api/v1/metadata/wfp_market)",
        inputSchema: {
          type: "object",
          properties: {
            location_code: { type: "string", description: "ISO3 country code filter" },
            admin1_code: { type: "string", description: "Admin1 p-code filter" },
            admin2_code: { type: "string", description: "Admin2 p-code filter" },
            name: { type: "string", description: "Market name filter" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },

      // ── COORDINATION & CONTEXT ────────────────────────────────────────────────
      {
        name: "get_operational_presence",
        description: "Get which humanitarian organizations are operating where and in which sectors (3W/4W/5W Who does What Where). (Docs: /api/v1/coordination-context/operational-presence)",
        inputSchema: {
          type: "object",
          properties: {
            location_code: { type: "string", description: "ISO3 country code (e.g. 'AFG', 'SOM', 'SDN')" },
            admin1_code: { type: "string", description: "Admin1 p-code filter" },
            admin2_code: { type: "string", description: "Admin2 p-code filter" },
            location_name: { type: "string", description: "Country name filter" },
            admin1_name: { type: "string", description: "Admin1 name filter" },
            admin2_name: { type: "string", description: "Admin2 name filter" },
            admin_level: { type: "integer", description: "Administrative level: 0=country, 1=admin1, 2=admin2" },
            sector_code: { type: "string", description: "Sector code filter" },
            sector_name: { type: "string", description: "Sector name filter" },
            org_acronym: { type: "string", description: "Organization acronym filter" },
            org_type_code: { type: "string", description: "Organization type code filter" },
            has_hrp: { type: "boolean", description: "Filter to locations with a Humanitarian Response Plan" },
            in_gho: { type: "boolean", description: "Filter to locations in the Global Humanitarian Overview" },
            resource_hdx_id: { type: "string", description: "Filter by source resource HDX ID" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_funding",
        description: "Get humanitarian appeal funding data: requirements, received amounts, and coverage %. (Docs: /api/v1/coordination-context/funding)",
        inputSchema: {
          type: "object",
          properties: {
            location_code: { type: "string", description: "ISO3 country code filter" },
            location_name: { type: "string", description: "Country name filter" },
            org_acronym: { type: "string", description: "Organization acronym filter" },
            appeal_code: { type: "string", description: "Appeal code (e.g. 'MDRKE047')" },
            appeal_type: { type: "string", description: "Appeal type (e.g. 'HRP', 'Flash', 'RRP', 'OPS')" },
            has_hrp: { type: "boolean", description: "Filter to locations with a Humanitarian Response Plan" },
            in_gho: { type: "boolean", description: "Filter to locations in the Global Humanitarian Overview" },
            resource_hdx_id: { type: "string", description: "Filter by source resource HDX ID" },
            start_date: { type: "string", description: "Filter rows where reference period overlaps/extends beyond this date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "Filter rows where reference period overlaps/begins before this date (YYYY-MM-DD)" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_conflict_events",
        description: "Get conflict event data (from ACLED) by country, event type, and date range. Event types: 'political_violence', 'civilian_targeting', 'demonstration'. (Docs: /api/v1/coordination-context/conflict-event)",
        inputSchema: {
          type: "object",
          properties: {
            location_code: { type: "string", description: "ISO3 country code filter" },
            admin1_code: { type: "string", description: "Admin1 p-code filter" },
            admin2_code: { type: "string", description: "Admin2 p-code filter" },
            location_name: { type: "string", description: "Country name filter" },
            admin1_name: { type: "string", description: "Admin1 name filter" },
            admin2_name: { type: "string", description: "Admin2 name filter" },
            admin_level: { type: "integer", description: "Administrative level: 0=country, 1=admin1, 2=admin2" },
            event_type: { type: "string", description: "Event type: 'political_violence', 'civilian_targeting', 'demonstration'" },
            has_hrp: { type: "boolean", description: "Filter to locations with a Humanitarian Response Plan" },
            in_gho: { type: "boolean", description: "Filter to locations in the Global Humanitarian Overview" },
            resource_hdx_id: { type: "string", description: "Filter by source resource HDX ID" },
            start_date: { type: "string", description: "Filter rows where reference period overlaps/extends beyond this date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "Filter rows where reference period overlaps/begins before this date (YYYY-MM-DD)" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_national_risk",
        description: "Get INFORM Risk Index scores and classifications by country. Risk classes 1-5 (Very Low to Very High). Supports filtering by individual risk component score ranges. (Docs: /api/v1/coordination-context/national-risk)",
        inputSchema: {
          type: "object",
          properties: {
            location_code: { type: "string", description: "ISO3 country code filter" },
            location_name: { type: "string", description: "Country name filter" },
            risk_class: { type: "integer", description: "Risk class 1-5: 1=Very Low, 2=Low, 3=Medium, 4=High, 5=Very High" },
            global_rank_min: { type: "integer", description: "Minimum global rank filter (1–250)" },
            global_rank_max: { type: "integer", description: "Maximum global rank filter (1–250)" },
            overall_risk_min: { type: "number", description: "Minimum overall INFORM risk score" },
            overall_risk_max: { type: "number", description: "Maximum overall INFORM risk score" },
            hazard_exposure_risk_min: { type: "number", description: "Minimum hazard & exposure risk score" },
            hazard_exposure_risk_max: { type: "number", description: "Maximum hazard & exposure risk score" },
            vulnerability_risk_min: { type: "number", description: "Minimum vulnerability risk score" },
            vulnerability_risk_max: { type: "number", description: "Maximum vulnerability risk score" },
            coping_capacity_risk_min: { type: "number", description: "Minimum coping capacity risk score" },
            coping_capacity_risk_max: { type: "number", description: "Maximum coping capacity risk score" },
            has_hrp: { type: "boolean", description: "Filter to locations with a Humanitarian Response Plan" },
            in_gho: { type: "boolean", description: "Filter to locations in the Global Humanitarian Overview" },
            resource_hdx_id: { type: "string", description: "Filter by source resource HDX ID" },
            start_date: { type: "string", description: "Filter rows where reference period overlaps/extends beyond this date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "Filter rows where reference period overlaps/begins before this date (YYYY-MM-DD)" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },

      // ── AFFECTED PEOPLE ───────────────────────────────────────────────────────
      {
        name: "get_idps",
        description: "Get Internally Displaced Persons (IDPs) population data by country and administrative level. Assessment types: 'BA'=Baseline, 'ETT'=Emergency Tracking, 'SA'=Site Assessment. (Docs: /api/v1/affected-people/idps)",
        inputSchema: {
          type: "object",
          properties: {
            location_code: { type: "string", description: "ISO3 country code filter" },
            admin1_code: { type: "string", description: "Admin1 p-code filter" },
            admin2_code: { type: "string", description: "Admin2 p-code filter" },
            location_name: { type: "string", description: "Country name filter" },
            admin1_name: { type: "string", description: "Admin1 name filter" },
            admin2_name: { type: "string", description: "Admin2 name filter" },
            admin_level: { type: "integer", description: "Administrative level: 0=country, 1=admin1, 2=admin2" },
            assessment_type: { type: "string", description: "Assessment type: 'BA'=Baseline, 'ETT'=Emergency Tracking Tool, 'SA'=Site Assessment" },
            reporting_round: { type: "integer", description: "Reporting round number filter" },
            operation: { type: "string", description: "Operation name filter" },
            has_hrp: { type: "boolean", description: "Filter to locations with a Humanitarian Response Plan" },
            in_gho: { type: "boolean", description: "Filter to locations in the Global Humanitarian Overview" },
            resource_hdx_id: { type: "string", description: "Filter by source resource HDX ID" },
            start_date: { type: "string", description: "Filter rows where reference period overlaps/extends beyond this date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "Filter rows where reference period overlaps/begins before this date (YYYY-MM-DD)" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_refugees",
        description: "Get UNHCR refugee and persons of concern data by origin/asylum country, population group, gender, and age. Population groups: REF, ASY, IDP, OIP, STA, OOC, RET, ROC, NAT, etc. (Docs: /api/v1/affected-people/refugees)",
        inputSchema: {
          type: "object",
          properties: {
            origin_location_code: { type: "string", description: "ISO3 origin country code (e.g. 'SYR'=Syria, 'AFG'=Afghanistan)" },
            asylum_location_code: { type: "string", description: "ISO3 asylum/host country code" },
            origin_location_name: { type: "string", description: "Origin country name filter" },
            asylum_location_name: { type: "string", description: "Asylum country name filter" },
            population_group: { type: "string", description: "Group code: REF=Refugees, ASY=Asylum Seekers, IDP=IDPs, OIP=Other in need, STA=Stateless, OOC=Other of concern, RET=Returnees, ROC=Returned of concern" },
            gender: { type: "string", description: "Gender: 'f'=Female, 'm'=Male, 'x'=Non-binary, 'u'=Unspecified, 'all'=All" },
            age_range: { type: "string", description: "Age range (e.g. '0-4', '5-17', '18-59', '60+', 'all')" },
            has_hrp: { type: "boolean", description: "Filter to locations with a Humanitarian Response Plan" },
            in_gho: { type: "boolean", description: "Filter to locations in the Global Humanitarian Overview" },
            resource_hdx_id: { type: "string", description: "Filter by source resource HDX ID" },
            start_date: { type: "string", description: "Filter rows where reference period overlaps/extends beyond this date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "Filter rows where reference period overlaps/begins before this date (YYYY-MM-DD)" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_returnees",
        description: "Get UNHCR returnee data (people who returned to their place of origin) by origin/departure country, gender, and age. (Docs: /api/v1/affected-people/returnees)",
        inputSchema: {
          type: "object",
          properties: {
            origin_location_code: { type: "string", description: "ISO3 origin country code" },
            asylum_location_code: { type: "string", description: "ISO3 departure country code" },
            origin_location_name: { type: "string", description: "Origin country name filter" },
            asylum_location_name: { type: "string", description: "Departure country name filter" },
            population_group: { type: "string", description: "Population group code (e.g. RDP=Returned Displaced, RST=Resettled, RRI=Returned Refugees)" },
            gender: { type: "string", description: "Gender: 'f'=Female, 'm'=Male, 'x'=Non-binary, 'u'=Unspecified, 'all'=All" },
            age_range: { type: "string", description: "Age range (e.g. '0-4', '5-17', '18-59', '60+', 'all')" },
            has_hrp: { type: "boolean", description: "Filter to locations with a Humanitarian Response Plan" },
            in_gho: { type: "boolean", description: "Filter to locations in the Global Humanitarian Overview" },
            resource_hdx_id: { type: "string", description: "Filter by source resource HDX ID" },
            start_date: { type: "string", description: "Filter rows where reference period overlaps/extends beyond this date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "Filter rows where reference period overlaps/begins before this date (YYYY-MM-DD)" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_humanitarian_needs",
        description: "Get Humanitarian Needs Overview (HNO) data: people affected, in-need, targeted, and reached by sector, location, gender, and age. Population status: AFF=Affected, INN=In-Need, TGT=Targeted, REA=Reached. (Docs: /api/v1/affected-people/humanitarian-needs)",
        inputSchema: {
          type: "object",
          properties: {
            location_code: { type: "string", description: "ISO3 country code filter" },
            admin1_code: { type: "string", description: "Admin1 p-code filter" },
            admin2_code: { type: "string", description: "Admin2 p-code filter" },
            location_name: { type: "string", description: "Country name filter" },
            admin1_name: { type: "string", description: "Admin1 name filter" },
            admin2_name: { type: "string", description: "Admin2 name filter" },
            admin_level: { type: "integer", description: "Administrative level: 0=country, 1=admin1, 2=admin2" },
            sector_code: { type: "string", description: "Sector code filter" },
            sector_name: { type: "string", description: "Sector name filter" },
            population_status: { type: "string", description: "Status: 'AFF'=Affected, 'INN'=In-Need, 'TGT'=Targeted, 'REA'=Reached, 'all'=All" },
            gender: { type: "string", description: "Gender: 'f'=Female, 'm'=Male, 'x'=Non-binary, 'u'=Unspecified, 'all'=All" },
            age_range: { type: "string", description: "Age range (e.g. '0-4', '5-17', '18-59', '60+')" },
            disabled_marker: { type: "string", description: "Disabled population: 'y'=Yes, 'n'=No, 'all'=All" },
            has_hrp: { type: "boolean", description: "Filter to locations with a Humanitarian Response Plan" },
            in_gho: { type: "boolean", description: "Filter to locations in the Global Humanitarian Overview" },
            resource_hdx_id: { type: "string", description: "Filter by source resource HDX ID" },
            start_date: { type: "string", description: "Filter rows where reference period overlaps/extends beyond this date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "Filter rows where reference period overlaps/begins before this date (YYYY-MM-DD)" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },

      // ── FOOD SECURITY, NUTRITION & POVERTY ───────────────────────────────────
      {
        name: "get_food_security",
        description: "Get IPC/CH food security phase classification data. IPC phases: 1=None/Minimal, 2=Stressed, 3=Crisis, 4=Emergency, 5=Catastrophe/Famine, '3+'=In Need of Action. (Docs: /api/v1/food-security-nutrition-poverty/food-security)",
        inputSchema: {
          type: "object",
          properties: {
            location_code: { type: "string", description: "ISO3 country code filter" },
            admin1_code: { type: "string", description: "Admin1 p-code filter" },
            admin2_code: { type: "string", description: "Admin2 p-code filter" },
            location_name: { type: "string", description: "Country name filter" },
            admin1_name: { type: "string", description: "Admin1 name filter" },
            admin2_name: { type: "string", description: "Admin2 name filter" },
            admin_level: { type: "integer", description: "Administrative level: 0=country, 1=admin1, 2=admin2" },
            ipc_phase: { type: "string", description: "IPC/CH phase: '1'=Minimal, '2'=Stressed, '3'=Crisis, '4'=Emergency, '5'=Famine, '3+'=In Need of Action, 'all'=Total population" },
            ipc_type: { type: "string", description: "Analysis period: 'current', 'first projection', 'second projection'" },
            has_hrp: { type: "boolean", description: "Filter to locations with a Humanitarian Response Plan" },
            in_gho: { type: "boolean", description: "Filter to locations in the Global Humanitarian Overview" },
            resource_hdx_id: { type: "string", description: "Filter by source resource HDX ID" },
            start_date: { type: "string", description: "Filter rows where reference period overlaps/extends beyond this date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "Filter rows where reference period overlaps/begins before this date (YYYY-MM-DD)" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_food_prices",
        description: "Get WFP VAM food price market monitor data by country, market, and commodity. Price types: Farm Gate, Retail, Wholesale. (Docs: /api/v1/food-security-nutrition-poverty/food-prices-market-monitor)",
        inputSchema: {
          type: "object",
          properties: {
            location_code: { type: "string", description: "ISO3 country code filter" },
            admin1_code: { type: "string", description: "Admin1 p-code filter" },
            admin2_code: { type: "string", description: "Admin2 p-code filter" },
            location_name: { type: "string", description: "Country name filter" },
            admin1_name: { type: "string", description: "Admin1 name filter" },
            admin2_name: { type: "string", description: "Admin2 name filter" },
            admin_level: { type: "integer", description: "Administrative level: 0=country, 1=admin1, 2=admin2" },
            market_name: { type: "string", description: "Market name filter" },
            commodity_code: { type: "string", description: "WFP commodity code filter" },
            commodity_name: { type: "string", description: "Commodity name filter" },
            currency_code: { type: "string", description: "Currency code filter (e.g. 'USD', 'KES')" },
            price_flag: { type: "string", description: "Price type: 'Farm Gate', 'Retail', 'Wholesale'" },
            has_hrp: { type: "boolean", description: "Filter to locations with a Humanitarian Response Plan" },
            in_gho: { type: "boolean", description: "Filter to locations in the Global Humanitarian Overview" },
            resource_hdx_id: { type: "string", description: "Filter by source resource HDX ID" },
            start_date: { type: "string", description: "Filter rows where reference period overlaps/extends beyond this date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "Filter rows where reference period overlaps/begins before this date (YYYY-MM-DD)" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
      {
        name: "get_poverty_rate",
        description: "Get multidimensional poverty rate (MPI) data by country and first-level administrative division. (Docs: /api/v1/food-security-nutrition-poverty/poverty-rate)",
        inputSchema: {
          type: "object",
          properties: {
            location_code: { type: "string", description: "ISO3 country code filter" },
            admin1_code: { type: "string", description: "Admin1 p-code filter" },
            location_name: { type: "string", description: "Country name filter" },
            admin1_name: { type: "string", description: "Admin1 name filter" },
            mpi_min: { type: "number", description: "Minimum MPI value filter (0-1)" },
            mpi_max: { type: "number", description: "Maximum MPI value filter (0-1)" },
            has_hrp: { type: "boolean", description: "Filter to locations with a Humanitarian Response Plan" },
            in_gho: { type: "boolean", description: "Filter to locations in the Global Humanitarian Overview" },
            resource_hdx_id: { type: "string", description: "Filter by source resource HDX ID" },
            start_date: { type: "string", description: "Filter rows where reference period overlaps/extends beyond this date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "Filter rows where reference period overlaps/begins before this date (YYYY-MM-DD)" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },

      // ── POPULATION ────────────────────────────────────────────────────────────
      {
        name: "get_population",
        description: "Get population data disaggregated by country, administrative level, gender, and age group. (Docs: /api/v1/population-social/population)",
        inputSchema: {
          type: "object",
          properties: {
            location_code: { type: "string", description: "ISO3 country code filter" },
            admin1_code: { type: "string", description: "Admin1 p-code filter" },
            admin2_code: { type: "string", description: "Admin2 p-code filter" },
            location_name: { type: "string", description: "Country name filter" },
            admin1_name: { type: "string", description: "Admin1 name filter" },
            admin2_name: { type: "string", description: "Admin2 name filter" },
            admin_level: { type: "integer", description: "Administrative level: 0=country, 1=admin1, 2=admin2" },
            gender: { type: "string", description: "Gender: 'f'=Female, 'm'=Male, 'x'=Non-binary, 'u'=Unspecified, 'all'=All" },
            age_range: { type: "string", description: "Age range (e.g. '0-4', '5-17', '18-59', '60+', 'all')" },
            has_hrp: { type: "boolean", description: "Filter to locations with a Humanitarian Response Plan" },
            in_gho: { type: "boolean", description: "Filter to locations in the Global Humanitarian Overview" },
            resource_hdx_id: { type: "string", description: "Filter by source resource HDX ID" },
            start_date: { type: "string", description: "Filter rows where reference period overlaps/extends beyond this date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "Filter rows where reference period overlaps/begins before this date (YYYY-MM-DD)" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },

      // ── CLIMATE ───────────────────────────────────────────────────────────────
      {
        name: "get_rainfall",
        description: "Get satellite-derived rainfall data with long-term averages and anomaly percentages, aggregated by dekad (10-day), 1-month, or 3-month periods. Version types: 'final', 'forecast', 'preliminary'. (Docs: /api/v1/climate/rainfall)",
        inputSchema: {
          type: "object",
          properties: {
            location_code: { type: "string", description: "ISO3 country code filter" },
            admin1_code: { type: "string", description: "Admin1 p-code filter" },
            admin2_code: { type: "string", description: "Admin2 p-code filter" },
            location_name: { type: "string", description: "Country name filter" },
            admin1_name: { type: "string", description: "Admin1 name filter" },
            admin2_name: { type: "string", description: "Admin2 name filter" },
            admin_level: { type: "integer", description: "Administrative level: 0=country, 1=admin1, 2=admin2" },
            aggregation_period: { type: "string", description: "Temporal aggregation: 'dekad' (10-day), '1-month', or '3-month'" },
            version: { type: "string", description: "Data version: 'final', 'forecast', or 'preliminary'" },
            has_hrp: { type: "boolean", description: "Filter to locations with a Humanitarian Response Plan" },
            in_gho: { type: "boolean", description: "Filter to locations in the Global Humanitarian Overview" },
            start_date: { type: "string", description: "Filter rows where reference period overlaps/extends beyond this date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "Filter rows where reference period overlaps/begins before this date (YYYY-MM-DD)" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
    ],
  };
});

// ─── TOOL EXECUTION ───────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;

    switch (name) {

      // METADATA
      case "get_locations":
        result = await callHapiApi("/metadata/location", {
          code: args.code,
          name: args.name,
          has_hrp: args.has_hrp,
          in_gho: args.in_gho,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_admin1":
        result = await callHapiApi("/metadata/admin1", {
          location_code: args.location_code,
          code: args.code,
          name: args.name,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_admin2":
        result = await callHapiApi("/metadata/admin2", {
          location_code: args.location_code,
          admin1_code: args.admin1_code,
          code: args.code,
          name: args.name,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_datasets":
        result = await callHapiApi("/metadata/dataset", {
          dataset_hdx_id: args.dataset_hdx_id,
          hdx_provider_stub: args.hdx_provider_stub,
          title: args.title,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_resources":
        result = await callHapiApi("/metadata/resource", {
          dataset_hdx_id: args.dataset_hdx_id,
          resource_hdx_id: args.resource_hdx_id,
          name: args.name,
          format: args.format,
          hxl_compliant: args.hxl_compliant,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_data_availability":
        result = await callHapiApi("/metadata/data_availability", {
          category: args.category,
          subcategory: args.subcategory,
          location_code: args.location_code,
          admin_level: args.admin_level,
          limit: args.limit || 200,
          offset: args.offset || 0,
        });
        break;

      case "get_sectors":
        result = await callHapiApi("/metadata/sector", {
          code: args.code,
          name: args.name,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_organizations":
        result = await callHapiApi("/metadata/org", {
          acronym: args.acronym,
          name: args.name,
          org_type_code: args.org_type_code,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_org_types":
        result = await callHapiApi("/metadata/org_type", {
          code: args.code,
          description: args.description,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_currencies":
        result = await callHapiApi("/metadata/currency", {
          code: args.code,
          name: args.name,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_wfp_commodities":
        result = await callHapiApi("/metadata/wfp_commodity", {
          code: args.code,
          name: args.name,
          category: args.category,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_wfp_markets":
        result = await callHapiApi("/metadata/wfp_market", {
          location_code: args.location_code,
          admin1_code: args.admin1_code,
          admin2_code: args.admin2_code,
          name: args.name,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      // COORDINATION & CONTEXT
      case "get_operational_presence":
        result = await callHapiApi("/coordination-context/operational-presence", {
          location_code: args.location_code,
          admin1_code: args.admin1_code,
          admin2_code: args.admin2_code,
          location_name: args.location_name,
          admin1_name: args.admin1_name,
          admin2_name: args.admin2_name,
          admin_level: args.admin_level,
          sector_code: args.sector_code,
          sector_name: args.sector_name,
          org_acronym: args.org_acronym,
          org_type_code: args.org_type_code,
          has_hrp: args.has_hrp,
          in_gho: args.in_gho,
          resource_hdx_id: args.resource_hdx_id,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_funding":
        result = await callHapiApi("/coordination-context/funding", {
          location_code: args.location_code,
          location_name: args.location_name,
          org_acronym: args.org_acronym,
          appeal_code: args.appeal_code,
          appeal_type: args.appeal_type,
          has_hrp: args.has_hrp,
          in_gho: args.in_gho,
          resource_hdx_id: args.resource_hdx_id,
          start_date: args.start_date,
          end_date: args.end_date,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_conflict_events":
        result = await callHapiApi("/coordination-context/conflict-event", {
          location_code: args.location_code,
          admin1_code: args.admin1_code,
          admin2_code: args.admin2_code,
          location_name: args.location_name,
          admin1_name: args.admin1_name,
          admin2_name: args.admin2_name,
          admin_level: args.admin_level,
          event_type: args.event_type,
          has_hrp: args.has_hrp,
          in_gho: args.in_gho,
          resource_hdx_id: args.resource_hdx_id,
          start_date: args.start_date,
          end_date: args.end_date,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_national_risk":
        result = await callHapiApi("/coordination-context/national-risk", {
          location_code: args.location_code,
          location_name: args.location_name,
          risk_class: args.risk_class,
          global_rank_min: args.global_rank_min,
          global_rank_max: args.global_rank_max,
          overall_risk_min: args.overall_risk_min,
          overall_risk_max: args.overall_risk_max,
          hazard_exposure_risk_min: args.hazard_exposure_risk_min,
          hazard_exposure_risk_max: args.hazard_exposure_risk_max,
          vulnerability_risk_min: args.vulnerability_risk_min,
          vulnerability_risk_max: args.vulnerability_risk_max,
          coping_capacity_risk_min: args.coping_capacity_risk_min,
          coping_capacity_risk_max: args.coping_capacity_risk_max,
          has_hrp: args.has_hrp,
          in_gho: args.in_gho,
          resource_hdx_id: args.resource_hdx_id,
          start_date: args.start_date,
          end_date: args.end_date,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      // AFFECTED PEOPLE
      case "get_idps":
        result = await callHapiApi("/affected-people/idps", {
          location_code: args.location_code,
          admin1_code: args.admin1_code,
          admin2_code: args.admin2_code,
          location_name: args.location_name,
          admin1_name: args.admin1_name,
          admin2_name: args.admin2_name,
          admin_level: args.admin_level,
          assessment_type: args.assessment_type,
          reporting_round: args.reporting_round,
          operation: args.operation,
          has_hrp: args.has_hrp,
          in_gho: args.in_gho,
          resource_hdx_id: args.resource_hdx_id,
          start_date: args.start_date,
          end_date: args.end_date,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_refugees":
        result = await callHapiApi("/affected-people/refugees", {
          origin_location_code: args.origin_location_code,
          asylum_location_code: args.asylum_location_code,
          origin_location_name: args.origin_location_name,
          asylum_location_name: args.asylum_location_name,
          population_group: args.population_group,
          gender: args.gender,
          age_range: args.age_range,
          has_hrp: args.has_hrp,
          in_gho: args.in_gho,
          resource_hdx_id: args.resource_hdx_id,
          start_date: args.start_date,
          end_date: args.end_date,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_returnees":
        result = await callHapiApi("/affected-people/returnees", {
          origin_location_code: args.origin_location_code,
          asylum_location_code: args.asylum_location_code,
          origin_location_name: args.origin_location_name,
          asylum_location_name: args.asylum_location_name,
          population_group: args.population_group,
          gender: args.gender,
          age_range: args.age_range,
          has_hrp: args.has_hrp,
          in_gho: args.in_gho,
          resource_hdx_id: args.resource_hdx_id,
          start_date: args.start_date,
          end_date: args.end_date,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_humanitarian_needs":
        result = await callHapiApi("/affected-people/humanitarian-needs", {
          location_code: args.location_code,
          admin1_code: args.admin1_code,
          admin2_code: args.admin2_code,
          location_name: args.location_name,
          admin1_name: args.admin1_name,
          admin2_name: args.admin2_name,
          admin_level: args.admin_level,
          sector_code: args.sector_code,
          sector_name: args.sector_name,
          population_status: args.population_status,
          gender: args.gender,
          age_range: args.age_range,
          disabled_marker: args.disabled_marker,
          has_hrp: args.has_hrp,
          in_gho: args.in_gho,
          resource_hdx_id: args.resource_hdx_id,
          start_date: args.start_date,
          end_date: args.end_date,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      // FOOD SECURITY, NUTRITION & POVERTY
      case "get_food_security":
        result = await callHapiApi("/food-security-nutrition-poverty/food-security", {
          location_code: args.location_code,
          admin1_code: args.admin1_code,
          admin2_code: args.admin2_code,
          location_name: args.location_name,
          admin1_name: args.admin1_name,
          admin2_name: args.admin2_name,
          admin_level: args.admin_level,
          ipc_phase: args.ipc_phase,
          ipc_type: args.ipc_type,
          has_hrp: args.has_hrp,
          in_gho: args.in_gho,
          resource_hdx_id: args.resource_hdx_id,
          start_date: args.start_date,
          end_date: args.end_date,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_food_prices":
        result = await callHapiApi("/food-security-nutrition-poverty/food-prices-market-monitor", {
          location_code: args.location_code,
          admin1_code: args.admin1_code,
          admin2_code: args.admin2_code,
          location_name: args.location_name,
          admin1_name: args.admin1_name,
          admin2_name: args.admin2_name,
          admin_level: args.admin_level,
          market_name: args.market_name,
          commodity_code: args.commodity_code,
          commodity_name: args.commodity_name,
          currency_code: args.currency_code,
          price_flag: args.price_flag,
          has_hrp: args.has_hrp,
          in_gho: args.in_gho,
          resource_hdx_id: args.resource_hdx_id,
          start_date: args.start_date,
          end_date: args.end_date,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      case "get_poverty_rate":
        result = await callHapiApi("/food-security-nutrition-poverty/poverty-rate", {
          location_code: args.location_code,
          admin1_code: args.admin1_code,
          location_name: args.location_name,
          admin1_name: args.admin1_name,
          mpi_min: args.mpi_min,
          mpi_max: args.mpi_max,
          has_hrp: args.has_hrp,
          in_gho: args.in_gho,
          resource_hdx_id: args.resource_hdx_id,
          start_date: args.start_date,
          end_date: args.end_date,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      // POPULATION
      case "get_population":
        result = await callHapiApi("/population-social/population", {
          location_code: args.location_code,
          admin1_code: args.admin1_code,
          admin2_code: args.admin2_code,
          location_name: args.location_name,
          admin1_name: args.admin1_name,
          admin2_name: args.admin2_name,
          admin_level: args.admin_level,
          gender: args.gender,
          age_range: args.age_range,
          has_hrp: args.has_hrp,
          in_gho: args.in_gho,
          resource_hdx_id: args.resource_hdx_id,
          start_date: args.start_date,
          end_date: args.end_date,
          limit: args.limit || 100,
          offset: args.offset || 0,
        });
        break;

      // CLIMATE
      case "get_rainfall":
        result = await callHapiApi("/climate/rainfall", {
          location_code: args.location_code,
          admin1_code: args.admin1_code,
          admin2_code: args.admin2_code,
          location_name: args.location_name,
          admin1_name: args.admin1_name,
          admin2_name: args.admin2_name,
          admin_level: args.admin_level,
          aggregation_period: args.aggregation_period,
          version: args.version,
          has_hrp: args.has_hrp,
          in_gho: args.in_gho,
          start_date: args.start_date,
          end_date: args.end_date,
          limit: args.limit || 100,
          offset: args.offset || 0,
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

// ─── START ────────────────────────────────────────────────────────────────────
async function run() {
  if (!HDX_APP_IDENTIFIER) {
    console.error(
      "FATAL: Cannot start. HDX_API_TOKEN not found in .env file.\n" +
      "Get yours at: https://hapi.humdata.org/docs#/Util/get_encoded_identifier_api_v1_encode_identifier_get"
    );
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("HDX HAPI MCP Server v2.0.0 running on stdio");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
