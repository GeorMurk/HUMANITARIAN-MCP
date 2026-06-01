/**
 * IFRC GO API MCP Server
 *
 * REQUIREMENTS:
 * 1. Create a .env file in the same folder containing: IFRC_API_TOKEN=your_token
 * 2. Run 'node server.js'
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

const IFRC_API_TOKEN = process.env.IFRC_API_TOKEN;
const BASE_URL = "https://goadmin.ifrc.org";

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
  { name: "ifrc-go-mcp", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

async function callIfrcApi(endpoint, params = {}) {
  if (!IFRC_API_TOKEN || IFRC_API_TOKEN === "") {
    throw new Error("ERROR: API Token not found. Please check your .env file.");
  }
  // Remove undefined params
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
  );
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: cleanParams,
      headers: {
        Authorization: `Bearer ${IFRC_API_TOKEN}`,
        Accept: "application/json",
      },
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

// --- TOOL DEFINITIONS ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [

      // ── SEARCH ──────────────────────────────────────────────────────────────
      {
        name: "search_ifrc",
        description: "Global search across all IFRC GO data. (Docs: /api/v1/search/)",
        inputSchema: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "Search term (required)" },
          },
          required: ["keyword"],
        },
      },

      // ── APPEALS ─────────────────────────────────────────────────────────────
      {
        name: "list_appeals",
        description: "List/search IFRC appeals with optional filters. (Docs: /api/v2/appeal/)",
        inputSchema: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "Search term" },
            country: { type: "integer", description: "Filter by country ID" },
            region: { type: "integer", description: "Filter by region ID" },
            appeal_type: { type: "integer", description: "Appeal type: 0=DREF, 1=Emergency Appeal, 2=International Appeal" },
            status: { type: "integer", description: "Status: 0=Active, 1=Closed" },
            disaster_type: { type: "integer", description: "Filter by disaster type ID" },
            limit: { type: "integer", description: "Max results (default 10)", default: 10 },
            offset: { type: "integer", description: "Pagination offset" },
          },
        },
      },
      {
        name: "get_appeal",
        description: "Get a single appeal by ID. (Docs: /api/v2/appeal/{id}/)",
        inputSchema: {
          type: "object",
          properties: {
            appeal_id: { type: "integer", description: "Appeal ID" },
          },
          required: ["appeal_id"],
        },
      },
      {
        name: "list_appeal_documents",
        description: "List appeal documents. (Docs: /api/v2/appeal_document/)",
        inputSchema: {
          type: "object",
          properties: {
            appeal: { type: "integer", description: "Filter by appeal ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },

      // ── EVENTS / EMERGENCIES ────────────────────────────────────────────────
      {
        name: "list_events",
        description: "List emergency events/disasters. (Docs: /api/v2/event/)",
        inputSchema: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "Search by event name" },
            country: { type: "integer", description: "Filter by country ID" },
            region: { type: "integer", description: "Filter by region ID" },
            disaster_type: { type: "integer", description: "Filter by disaster type ID" },
            date_from: { type: "string", description: "Start date filter (YYYY-MM-DD)" },
            date_to: { type: "string", description: "End date filter (YYYY-MM-DD)" },
            is_featured: { type: "boolean", description: "Only return featured events" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_event",
        description: "Get a single emergency event by ID. (Docs: /api/v2/event/{id}/)",
        inputSchema: {
          type: "object",
          properties: {
            event_id: { type: "integer", description: "Event ID" },
          },
          required: ["event_id"],
        },
      },
      {
        name: "list_disaster_types",
        description: "List all disaster/hazard types. (Docs: /api/v2/disaster_type/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 50 },
          },
        },
      },
      {
        name: "list_go_historical",
        description: "List historical GO emergency data. (Docs: /api/v2/go-historical/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },

      // ── FIELD REPORTS ────────────────────────────────────────────────────────
      {
        name: "list_field_reports",
        description: "List field reports. (Docs: /api/v2/field-report/)",
        inputSchema: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "Search term" },
            country: { type: "integer", description: "Filter by country ID" },
            event: { type: "integer", description: "Filter by event ID" },
            disaster_type: { type: "integer", description: "Filter by disaster type ID" },
            date_from: { type: "string", description: "Created after (YYYY-MM-DD)" },
            date_to: { type: "string", description: "Created before (YYYY-MM-DD)" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_field_report",
        description: "Get a single field report by ID. (Docs: /api/v2/field-report/{id}/)",
        inputSchema: {
          type: "object",
          properties: {
            report_id: { type: "integer", description: "Field report ID" },
          },
          required: ["report_id"],
        },
      },

      // ── COUNTRIES ────────────────────────────────────────────────────────────
      {
        name: "list_countries",
        description: "List countries with optional filters. (Docs: /api/v2/country/)",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Filter by country name" },
            iso: { type: "string", description: "ISO 2-letter code (e.g. KE)" },
            region: { type: "integer", description: "Filter by region ID" },
            independent: { type: "boolean", description: "Only independent states" },
            limit: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_country_profile",
        description: "Get detailed country info by ID. (Docs: /api/v2/country/{id}/)",
        inputSchema: {
          type: "object",
          properties: {
            country_id: { type: "integer", description: "Country ID" },
          },
          required: ["country_id"],
        },
      },
      {
        name: "get_country_databank",
        description: "Get country stats: population, GDP, climate, etc. (Docs: /api/v2/country/{id}/databank/)",
        inputSchema: {
          type: "object",
          properties: {
            country_id: { type: "integer", description: "Country ID" },
          },
          required: ["country_id"],
        },
      },
      {
        name: "list_country_key_figures",
        description: "List key figures for a country. (Docs: /api/v2/country_key_figure/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Country ID" },
            limit: { type: "integer", default: 20 },
          },
        },
      },
      {
        name: "list_country_snippets",
        description: "List country content snippets/highlights. (Docs: /api/v2/country_snippet/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Country ID" },
            limit: { type: "integer", default: 20 },
          },
        },
      },
      {
        name: "list_historical_disasters",
        description: "Get historical disasters for a country. (Docs: /api/v2/country/{id}/historical-disaster/)",
        inputSchema: {
          type: "object",
          properties: {
            country_id: { type: "integer", description: "Country ID" },
            start_date: { type: "string", description: "YYYY-MM-DD" },
            end_date: { type: "string", description: "YYYY-MM-DD" },
          },
          required: ["country_id"],
        },
      },
      {
        name: "get_country_income",
        description: "Get country income/classification data. (Docs: /api/v2/country-income/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Country ID" },
            limit: { type: "integer", default: 20 },
          },
        },
      },

      // ── REGIONS ──────────────────────────────────────────────────────────────
      {
        name: "list_regions",
        description: "List IFRC regions (Africa, Americas, Asia Pacific, Europe, MENA). (Docs: /api/v2/region/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 10 },
          },
        },
      },
      {
        name: "get_region",
        description: "Get a single region by ID. (Docs: /api/v2/region/{id}/)",
        inputSchema: {
          type: "object",
          properties: {
            region_id: { type: "integer", description: "Region ID" },
          },
          required: ["region_id"],
        },
      },
      {
        name: "list_region_key_figures",
        description: "List key figures for a region. (Docs: /api/v2/region_key_figure/)",
        inputSchema: {
          type: "object",
          properties: {
            region: { type: "integer", description: "Region ID" },
            limit: { type: "integer", default: 20 },
          },
        },
      },

      // ── DISTRICTS / ADMIN ────────────────────────────────────────────────────
      {
        name: "list_districts",
        description: "List administrative districts/sub-national units. (Docs: /api/v2/district/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            name: { type: "string", description: "Filter by district name" },
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── DREF ─────────────────────────────────────────────────────────────────
      {
        name: "list_active_drefs",
        description: "List active Disaster Response Emergency Funds (DREF). (Docs: /api/v2/active-dref/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_completed_drefs",
        description: "List completed DREFs. (Docs: /api/v2/completed-dref/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_dref_operational_updates",
        description: "List DREF operational updates. (Docs: /api/v2/dref-op-update/)",
        inputSchema: {
          type: "object",
          properties: {
            dref: { type: "integer", description: "Filter by DREF ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_dref_final_reports",
        description: "List DREF final reports. (Docs: /api/v2/dref-final-report/)",
        inputSchema: {
          type: "object",
          properties: {
            dref: { type: "integer", description: "Filter by DREF ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },

      // ── SURGE / ERU / PERSONNEL ──────────────────────────────────────────────
      {
        name: "list_surge_alerts",
        description: "List surge alerts for emergency deployments. (Docs: /api/v2/surge_alert/)",
        inputSchema: {
          type: "object",
          properties: {
            event: { type: "integer", description: "Filter by event ID" },
            country: { type: "integer", description: "Filter by country ID" },
            is_active: { type: "boolean", description: "Only active alerts" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_eru",
        description: "List Emergency Response Units (ERU). (Docs: /api/v2/eru/)",
        inputSchema: {
          type: "object",
          properties: {
            event: { type: "integer", description: "Filter by event/emergency ID" },
            country: { type: "integer", description: "Filter by country ID" },
            type: { type: "integer", description: "ERU type (0=Basecamp, 1=WASH, 2=IT, etc.)" },
            deployed_to: { type: "integer", description: "Filter by deployed-to country ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_eru_owners",
        description: "List ERU owner National Societies. (Docs: /api/v2/eru_owner/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_personnel",
        description: "List deployed surge personnel/delegates. (Docs: /api/v2/personnel/)",
        inputSchema: {
          type: "object",
          properties: {
            event: { type: "integer", description: "Filter by event ID" },
            country_from: { type: "integer", description: "Filter by sending country ID" },
            country_to: { type: "integer", description: "Filter by receiving country ID" },
            type: { type: "string", description: "Personnel type (e.g. delegate, heop, rdrt)" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_personnel_deployments",
        description: "List personnel deployment records. (Docs: /api/v2/personnel_deployment/)",
        inputSchema: {
          type: "object",
          properties: {
            country_deployed_to: { type: "integer", description: "Filter by deployed-to country ID" },
            event_deployed_to: { type: "integer", description: "Filter by event ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_partner_deployments",
        description: "List partner society deployments. (Docs: /api/v2/partner_deployment/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            event: { type: "integer", description: "Filter by event ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_aggregated_eru_rapid_response",
        description: "Get aggregated ERU and rapid response statistics. (Docs: /api/v2/aggregated-eru-and-rapid-response/)",
        inputSchema: {
          type: "object",
          properties: {
            event: { type: "integer", description: "Filter by event ID" },
          },
        },
      },

      // ── FLASH UPDATES ────────────────────────────────────────────────────────
      {
        name: "list_flash_updates",
        description: "List flash updates (rapid situation reports). (Docs: /api/v2/flash-update/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            hazard_type: { type: "string", description: "Filter by hazard type slug" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_flash_update",
        description: "Get a single flash update by ID. (Docs: /api/v2/flash-update/{id}/)",
        inputSchema: {
          type: "object",
          properties: {
            flash_update_id: { type: "integer", description: "Flash update ID" },
          },
          required: ["flash_update_id"],
        },
      },

      // ── SITUATION REPORTS ────────────────────────────────────────────────────
      {
        name: "list_situation_reports",
        description: "List situation reports. (Docs: /api/v2/situation_report/)",
        inputSchema: {
          type: "object",
          properties: {
            appeal: { type: "integer", description: "Filter by appeal ID" },
            event: { type: "integer", description: "Filter by event ID" },
            type: { type: "integer", description: "Filter by situation report type ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_situation_report_types",
        description: "List situation report types. (Docs: /api/v2/situation_report_type/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 50 },
          },
        },
      },

      // ── PROJECTS (3W) ────────────────────────────────────────────────────────
      {
        name: "list_projects",
        description: "List 3W (Who does What Where) projects. (Docs: /api/v2/project/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            region: { type: "integer", description: "Filter by region ID" },
            reporting_ns: { type: "integer", description: "Filter by reporting National Society country ID" },
            operation_type: { type: "integer", description: "0=Programme, 1=Emergency Operation" },
            primary_sector: { type: "integer", description: "Filter by primary sector ID" },
            status: { type: "integer", description: "1=Ongoing, 2=Completed, 3=Planned" },
            keyword: { type: "string", description: "Search term" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_project",
        description: "Get a single 3W project by ID. (Docs: /api/v2/project/{id}/)",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "integer", description: "Project ID" },
          },
          required: ["project_id"],
        },
      },
      {
        name: "list_emergency_projects",
        description: "List emergency response activity projects (in-field activities). (Docs: /api/v2/emergency-project/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            event: { type: "integer", description: "Filter by event ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_regional_projects",
        description: "List regional projects. (Docs: /api/v2/regional-project/)",
        inputSchema: {
          type: "object",
          properties: {
            region: { type: "integer", description: "Filter by region ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },

      // ── PER (PREPAREDNESS FOR EFFECTIVE RESPONSE) ───────────────────────────
      {
        name: "list_per_overviews",
        description: "List PER (Preparedness for Effective Response) overviews. (Docs: /api/v2/per-overview/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_per_process_status",
        description: "List PER process statuses by country. (Docs: /api/v2/per-process-status/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_public_per_process_status",
        description: "List public PER process statuses. (Docs: /api/v2/public-per-process-status/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_per_stats",
        description: "Get PER statistics. (Docs: /api/v2/per-stats/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
          },
        },
      },
      {
        name: "get_public_per_stats",
        description: "Get public PER statistics. (Docs: /api/v2/public-per-stats/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
          },
        },
      },
      {
        name: "list_per_assessments",
        description: "List PER assessments. (Docs: /api/v2/per-assessment/)",
        inputSchema: {
          type: "object",
          properties: {
            overview: { type: "integer", description: "Filter by PER overview ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_per_prioritizations",
        description: "List PER prioritizations. (Docs: /api/v2/per-prioritization/)",
        inputSchema: {
          type: "object",
          properties: {
            overview: { type: "integer", description: "Filter by PER overview ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_per_work_plans",
        description: "List PER work plans. (Docs: /api/v2/per-work-plan/)",
        inputSchema: {
          type: "object",
          properties: {
            overview: { type: "integer", description: "Filter by PER overview ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_per_form_areas",
        description: "List PER form areas/components framework. (Docs: /api/v2/per-formarea/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 50 },
          },
        },
      },
      {
        name: "list_per_form_components",
        description: "List PER form components. (Docs: /api/v2/per-formcomponent/)",
        inputSchema: {
          type: "object",
          properties: {
            area: { type: "integer", description: "Filter by area ID" },
            limit: { type: "integer", default: 50 },
          },
        },
      },
      {
        name: "list_per_form_questions",
        description: "List PER assessment questions. (Docs: /api/v2/per-formquestion/)",
        inputSchema: {
          type: "object",
          properties: {
            component: { type: "integer", description: "Filter by component ID" },
            limit: { type: "integer", default: 50 },
          },
        },
      },

      // ── LOCAL UNITS ──────────────────────────────────────────────────────────
      {
        name: "list_local_units",
        description: "List National Society local units (branches). (Docs: /api/v2/local-units/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            type: { type: "integer", description: "Local unit type ID" },
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_public_local_units",
        description: "List public local units (no auth required). (Docs: /api/v2/public-local-units/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_health_local_units",
        description: "List health-focused local units. (Docs: /api/v2/health-local-units/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── EAP (EARLY ACTION PROTOCOLS) ────────────────────────────────────────
      {
        name: "list_active_eaps",
        description: "List active Early Action Protocols. (Docs: /api/v2/active-eap/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_simplified_eap",
        description: "Get a simplified EAP by ID. (Docs: /api/v2/simplified-eap/{id}/)",
        inputSchema: {
          type: "object",
          properties: {
            eap_id: { type: "integer", description: "EAP ID" },
          },
          required: ["eap_id"],
        },
      },
      {
        name: "get_full_eap",
        description: "Get full EAP details by ID. (Docs: /api/v2/full-eap/{id}/)",
        inputSchema: {
          type: "object",
          properties: {
            eap_id: { type: "integer", description: "EAP ID" },
          },
          required: ["eap_id"],
        },
      },

      // ── OPERATIONS LEARNING ──────────────────────────────────────────────────
      {
        name: "list_ops_learning",
        description: "List operational learning extracts from reviews/evaluations. (Docs: /api/v2/ops-learning/)",
        inputSchema: {
          type: "object",
          properties: {
            appeal_code: { type: "string", description: "Filter by appeal code (e.g. MDRKE047)" },
            sector: { type: "integer", description: "Filter by sector ID" },
            per_component: { type: "integer", description: "Filter by PER component ID" },
            limit: { type: "integer", default: 10 },
            offset: { type: "integer" },
          },
        },
      },

      // ── NS LINKS / EXTERNAL PARTNERS ────────────────────────────────────────
      {
        name: "list_nslinks",
        description: "List National Society links/websites. (Docs: /api/v2/nslinks/)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "integer", description: "Filter by country ID" },
            limit: { type: "integer", default: 20 },
          },
        },
      },
      {
        name: "list_external_partners",
        description: "List external partner organizations. (Docs: /api/v2/external_partner/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 20 },
          },
        },
      },
      {
        name: "list_supported_activities",
        description: "List supported activity types. (Docs: /api/v2/supported_activity/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 50 },
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
      case "search_ifrc":
        result = await callIfrcApi("/api/v1/search/", { keyword: args.keyword });
        break;

      // APPEALS
      case "list_appeals":
        result = await callIfrcApi("/api/v2/appeal/", {
          search: args.keyword,
          country: args.country,
          region: args.region,
          atype: args.appeal_type,
          status: args.status,
          dtype: args.disaster_type,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "get_appeal":
        result = await callIfrcApi(`/api/v2/appeal/${args.appeal_id}/`);
        break;
      case "list_appeal_documents":
        result = await callIfrcApi("/api/v2/appeal_document/", {
          appeal: args.appeal,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;

      // EVENTS
      case "list_events":
        result = await callIfrcApi("/api/v2/event/", {
          search: args.keyword,
          countries__in: args.country,
          regions__in: args.region,
          dtype: args.disaster_type,
          disaster_start_date__gte: args.date_from,
          disaster_start_date__lte: args.date_to,
          is_featured: args.is_featured,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "get_event":
        result = await callIfrcApi(`/api/v2/event/${args.event_id}/`);
        break;
      case "list_disaster_types":
        result = await callIfrcApi("/api/v2/disaster_type/", { limit: args.limit || 50 });
        break;
      case "list_go_historical":
        result = await callIfrcApi("/api/v2/go-historical/", {
          country: args.country,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;

      // FIELD REPORTS
      case "list_field_reports":
        result = await callIfrcApi("/api/v2/field-report/", {
          search: args.keyword,
          countries: args.country,
          event: args.event,
          dtype: args.disaster_type,
          created_at__gte: args.date_from,
          created_at__lte: args.date_to,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "get_field_report":
        result = await callIfrcApi(`/api/v2/field-report/${args.report_id}/`);
        break;

      // COUNTRIES
      case "list_countries":
        result = await callIfrcApi("/api/v2/country/", {
          name: args.name,
          iso: args.iso,
          region: args.region,
          independent: args.independent,
          limit: args.limit || 50,
          offset: args.offset,
        });
        break;
      case "get_country_profile":
        result = await callIfrcApi(`/api/v2/country/${args.country_id}/`);
        break;
      case "get_country_databank":
        result = await callIfrcApi(`/api/v2/country/${args.country_id}/databank/`);
        break;
      case "list_country_key_figures":
        result = await callIfrcApi("/api/v2/country_key_figure/", {
          country: args.country,
          limit: args.limit || 20,
        });
        break;
      case "list_country_snippets":
        result = await callIfrcApi("/api/v2/country_snippet/", {
          country: args.country,
          limit: args.limit || 20,
        });
        break;
      case "list_historical_disasters":
        result = await callIfrcApi(`/api/v2/country/${args.country_id}/historical-disaster/`, {
          start_date_from: args.start_date,
          start_date_to: args.end_date,
        });
        break;
      case "get_country_income":
        result = await callIfrcApi("/api/v2/country-income/", {
          country: args.country,
          limit: args.limit || 20,
        });
        break;

      // REGIONS
      case "list_regions":
        result = await callIfrcApi("/api/v2/region/", { limit: args.limit || 10 });
        break;
      case "get_region":
        result = await callIfrcApi(`/api/v2/region/${args.region_id}/`);
        break;
      case "list_region_key_figures":
        result = await callIfrcApi("/api/v2/region_key_figure/", {
          region: args.region,
          limit: args.limit || 20,
        });
        break;

      // DISTRICTS
      case "list_districts":
        result = await callIfrcApi("/api/v2/district/", {
          country_id: args.country,
          name: args.name,
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;

      // DREF
      case "list_active_drefs":
        result = await callIfrcApi("/api/v2/active-dref/", {
          country: args.country,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "list_completed_drefs":
        result = await callIfrcApi("/api/v2/completed-dref/", {
          country: args.country,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "list_dref_operational_updates":
        result = await callIfrcApi("/api/v2/dref-op-update/", {
          dref: args.dref,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "list_dref_final_reports":
        result = await callIfrcApi("/api/v2/dref-final-report/", {
          dref: args.dref,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;

      // SURGE / ERU / PERSONNEL
      case "list_surge_alerts":
        result = await callIfrcApi("/api/v2/surge_alert/", {
          event: args.event,
          country: args.country,
          is_active: args.is_active,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "list_eru":
        result = await callIfrcApi("/api/v2/eru/", {
          event: args.event,
          eru_owner__country: args.country,
          type: args.type,
          deployed_to__id: args.deployed_to,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "list_eru_owners":
        result = await callIfrcApi("/api/v2/eru_owner/", {
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;
      case "list_personnel":
        result = await callIfrcApi("/api/v2/personnel/", {
          event_deployed_to: args.event,
          country_from: args.country_from,
          country_to: args.country_to,
          type: args.type,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "list_personnel_deployments":
        result = await callIfrcApi("/api/v2/personnel_deployment/", {
          country_deployed_to: args.country_deployed_to,
          event_deployed_to: args.event_deployed_to,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "list_partner_deployments":
        result = await callIfrcApi("/api/v2/partner_deployment/", {
          country: args.country,
          event: args.event,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "get_aggregated_eru_rapid_response":
        result = await callIfrcApi("/api/v2/aggregated-eru-and-rapid-response/", {
          event: args.event,
        });
        break;

      // FLASH UPDATES
      case "list_flash_updates":
        result = await callIfrcApi("/api/v2/flash-update/", {
          country: args.country,
          hazard_type: args.hazard_type,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "get_flash_update":
        result = await callIfrcApi(`/api/v2/flash-update/${args.flash_update_id}/`);
        break;

      // SITUATION REPORTS
      case "list_situation_reports":
        result = await callIfrcApi("/api/v2/situation_report/", {
          appeal: args.appeal,
          event: args.event,
          type: args.type,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "list_situation_report_types":
        result = await callIfrcApi("/api/v2/situation_report_type/", {
          limit: args.limit || 50,
        });
        break;

      // PROJECTS
      case "list_projects":
        result = await callIfrcApi("/api/v2/project/", {
          project_country: args.country,
          region: args.region,
          reporting_ns: args.reporting_ns,
          operation_type: args.operation_type,
          primary_sector: args.primary_sector,
          status: args.status,
          search: args.keyword,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "get_project":
        result = await callIfrcApi(`/api/v2/project/${args.project_id}/`);
        break;
      case "list_emergency_projects":
        result = await callIfrcApi("/api/v2/emergency-project/", {
          country: args.country,
          event: args.event,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "list_regional_projects":
        result = await callIfrcApi("/api/v2/regional-project/", {
          region: args.region,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;

      // PER
      case "list_per_overviews":
        result = await callIfrcApi("/api/v2/per-overview/", {
          country: args.country,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "list_per_process_status":
        result = await callIfrcApi("/api/v2/per-process-status/", {
          country: args.country,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "list_public_per_process_status":
        result = await callIfrcApi("/api/v2/public-per-process-status/", {
          country: args.country,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "get_per_stats":
        result = await callIfrcApi("/api/v2/per-stats/", { country: args.country });
        break;
      case "get_public_per_stats":
        result = await callIfrcApi("/api/v2/public-per-stats/", { country: args.country });
        break;
      case "list_per_assessments":
        result = await callIfrcApi("/api/v2/per-assessment/", {
          overview: args.overview,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "list_per_prioritizations":
        result = await callIfrcApi("/api/v2/per-prioritization/", {
          overview: args.overview,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "list_per_work_plans":
        result = await callIfrcApi("/api/v2/per-work-plan/", {
          overview: args.overview,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "list_per_form_areas":
        result = await callIfrcApi("/api/v2/per-formarea/", { limit: args.limit || 50 });
        break;
      case "list_per_form_components":
        result = await callIfrcApi("/api/v2/per-formcomponent/", {
          area: args.area,
          limit: args.limit || 50,
        });
        break;
      case "list_per_form_questions":
        result = await callIfrcApi("/api/v2/per-formquestion/", {
          component: args.component,
          limit: args.limit || 50,
        });
        break;

      // LOCAL UNITS
      case "list_local_units":
        result = await callIfrcApi("/api/v2/local-units/", {
          country: args.country,
          type: args.type,
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;
      case "list_public_local_units":
        result = await callIfrcApi("/api/v2/public-local-units/", {
          country: args.country,
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;
      case "list_health_local_units":
        result = await callIfrcApi("/api/v2/health-local-units/", {
          country: args.country,
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;

      // EAP
      case "list_active_eaps":
        result = await callIfrcApi("/api/v2/active-eap/", {
          country: args.country,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;
      case "get_simplified_eap":
        result = await callIfrcApi(`/api/v2/simplified-eap/${args.eap_id}/`);
        break;
      case "get_full_eap":
        result = await callIfrcApi(`/api/v2/full-eap/${args.eap_id}/`);
        break;

      // OPS LEARNING
      case "list_ops_learning":
        result = await callIfrcApi("/api/v2/ops-learning/", {
          appeal_code: args.appeal_code,
          sector: args.sector,
          per_component: args.per_component,
          limit: args.limit || 10,
          offset: args.offset,
        });
        break;

      // NS LINKS / EXTERNAL PARTNERS
      case "list_nslinks":
        result = await callIfrcApi("/api/v2/nslinks/", {
          country: args.country,
          limit: args.limit || 20,
        });
        break;
      case "list_external_partners":
        result = await callIfrcApi("/api/v2/external_partner/", {
          limit: args.limit || 20,
        });
        break;
      case "list_supported_activities":
        result = await callIfrcApi("/api/v2/supported_activity/", {
          limit: args.limit || 50,
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
  if (!IFRC_API_TOKEN) {
    console.error("FATAL: Cannot start server. Missing IFRC_API_TOKEN in .env file.");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("IFRC MCP Server v2.0.0 running on stdio (Token loaded from .env)");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
