/**
 * ACAPS API MCP Server
 *
 * Wraps the ACAPS Data API (https://api.acaps.org/api/v1/) — all 70 dataset
 * endpoints, driven by a registry generated from the API's own OpenAPI schema
 * (acaps-endpoints.json). Nothing here hand-types an endpoint path.
 *
 * REQUIREMENTS:
 * 1. Create a .env file in this folder (or a parent) containing:
 *      ACAPS_USERNAME=your_email
 *      ACAPS_PASSWORD=your_password
 * 2. Run 'node server.js'
 *
 * AUTH FLOW:
 *   The server POSTs the credentials to /api/v1/get-auth-token/ to obtain an
 *   auth token, then sends "Authorization: Token <token>" on every request.
 *   The token is fetched lazily and cached; on a 401/403 it is refreshed once.
 *
 * COVERAGE MODEL:
 *   - `list_acaps_datasets`  — catalog of every endpoint + its fields.
 *   - `acaps_request`        — generic call to ANY endpoint (guarantees 100%
 *                              coverage of the 70 datasets).
 *   - The remaining tools are ergonomic wrappers over the same registry for the
 *     flagship global datasets and the four country programmes.
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

const ACAPS_USERNAME = process.env.ACAPS_USERNAME;
const ACAPS_PASSWORD = process.env.ACAPS_PASSWORD;
const BASE_URL = "https://api.acaps.org";

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

// Endpoint registry generated from the ACAPS OpenAPI schema.
// Shape: { slug: { path, dated, group, name, fields[] } }
const REGISTRY = require("./acaps-endpoints.json");

const server = new Server(
  { name: "acaps-mcp", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

// --- AUTH ---
let cachedToken = null;

async function fetchToken() {
  if (!ACAPS_USERNAME || !ACAPS_PASSWORD) {
    throw new Error(
      "ERROR: ACAPS_USERNAME / ACAPS_PASSWORD not found. Please check your .env file."
    );
  }
  try {
    const response = await axios.post(
      `${BASE_URL}/api/v1/get-auth-token/`,
      { username: ACAPS_USERNAME, password: ACAPS_PASSWORD },
      { headers: { Accept: "application/json" }, timeout: 15000 }
    );
    if (!response.data || !response.data.token) {
      throw new Error("Auth response did not contain a token.");
    }
    return response.data.token;
  } catch (error) {
    if (error.response) {
      throw new Error(
        `Authentication failed (${error.response.status}): ${JSON.stringify(error.response.data)}`
      );
    }
    throw new Error(`Authentication request failed: ${error.message}`);
  }
}

async function getToken(forceRefresh = false) {
  if (forceRefresh || !cachedToken) {
    cachedToken = await fetchToken();
  }
  return cachedToken;
}

// --- API CALL ---
// ACAPS datasets follow redirects (e.g. the latest snapshot). axios follows
// them and preserves the Authorization header on the same host.
async function callAcapsApi(endpoint, params = {}) {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(
      ([_, v]) => v !== undefined && v !== null && v !== ""
    )
  );

  const doRequest = async (token) =>
    axios.get(`${BASE_URL}${endpoint}`, {
      params: cleanParams,
      headers: { Authorization: `Token ${token}`, Accept: "application/json" },
      timeout: 60000,
    });

  try {
    let token = await getToken();
    try {
      const response = await doRequest(token);
      return response.data;
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        token = await getToken(true);
        const response = await doRequest(token);
        return response.data;
      }
      throw error;
    }
  } catch (error) {
    if (error.response) {
      throw new Error(
        `API Error ${error.response.status}: ${JSON.stringify(error.response.data)}`
      );
    }
    throw new Error(`Request failed: ${error.message}`);
  }
}

// Build the concrete request path for a registry entry.
// For dated endpoints: substitute a period (e.g. "Jan2024") into {date}, or
// drop the {date} segment when none is given so the API serves the latest.
function buildPath(entry, date) {
  let p = entry.path;
  if (entry.dated) {
    if (date && String(date).trim() !== "") {
      p = p.replace("{date}", String(date).trim());
    } else {
      p = p.replace("{date}/", "").replace("{date}", "");
    }
  }
  return p;
}

// Central dispatch: resolve a slug against the registry and call it.
// opts: { date, ordering, page, date_from, date_to, explicit:{}, filters:{} }
async function callSlug(slug, opts = {}) {
  const entry = REGISTRY[slug];
  if (!entry) {
    throw new Error(`Unknown dataset slug '${slug}'. Use list_acaps_datasets to see valid slugs.`);
  }
  const params = {};
  if (opts.ordering) params.ordering = opts.ordering;
  if (opts.page) params.page = opts.page;
  if (opts.date_from) params._internal_filter_date_gte = opts.date_from;
  if (opts.date_to) params._internal_filter_date_lte = opts.date_to;
  Object.assign(params, opts.explicit || {}, opts.filters || {});
  return callAcapsApi(buildPath(entry, opts.date), params);
}

// Shared JSON-schema fragments reused across tool definitions.
const P_ORDERING = { type: "string", description: "Order by a field name; prefix with '-' for descending (e.g. -date)" };
const P_PAGE = { type: "integer", description: "Page number (100 results per page)" };
const P_FILTERS = {
  type: "object",
  additionalProperties: true,
  description: "Any additional exact-match field filters (see list_acaps_datasets for each dataset's fields), e.g. { \"iso3\": \"AFG\" }",
};
const P_DATE = { type: "string", description: "Historical snapshot as MonYYYY (e.g. Jan2024). Omit for the latest." };
const P_DATE_FROM = { type: "string", description: "Filter records with internal date >= this (YYYY-MM-DD)" };
const P_DATE_TO = { type: "string", description: "Filter records with internal date <= this (YYYY-MM-DD)" };

// Country-programme enums (validated against the registry at call time).
const AFG_TABLES = ["acled", "ipc_current", "non_food_prices", "reach_food_basket", "reach_multi_item_prices", "wfp_food_prices"];
const YEMEN_TABLES = ["agency_presence", "conflict", "displace_and_return", "economy", "education", "health", "hfs_names", "ipc_district", "ipc_governorate", "livelihoods", "non_yemeni_migrants", "nutrition", "pin_and_severity", "wash", "monitoring", "monitoring_indicators"];
const UKRAINE_TABLES = ["access_events", "damages", "master_dataset", "master_dataset_log", "regional_dataset", "regional_dataset_log", "subnational_access", "subnational_access_raion"];
const TSQ_TABLES = ["humanitarian_access", "humanitarian_access_events", "inform_severity_index", "information_landscape", "protection", "risk_list", "seasonal_events_calendar_seasonal_calendar", "seasonal_events_calendar_events_timeline"];

// --- TOOL DEFINITIONS ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ── DISCOVERY & GENERIC ──────────────────────────────────────────────
      {
        name: "list_acaps_datasets",
        description:
          "Catalog of all 70 ACAPS dataset endpoints — slug, group, path, whether it takes a historical date, and its filterable fields. Use this to discover data and to find the slug for acaps_request.",
        inputSchema: {
          type: "object",
          properties: {
            group: { type: "string", description: "Optional: filter the catalog to one group (e.g. 'Yemen', 'INFORM Severity Index')" },
            fields: { type: "boolean", description: "Include each dataset's full field list (default true)", default: true },
          },
        },
      },
      {
        name: "acaps_request",
        description:
          "Generic escape hatch — call ANY ACAPS dataset by its slug (from list_acaps_datasets). Covers all 70 endpoints. Filters are exact-match on field names.",
        inputSchema: {
          type: "object",
          properties: {
            slug: { type: "string", description: "Dataset slug from list_acaps_datasets (e.g. inform_severity_index, yemen_core_dataset_conflict)" },
            date: P_DATE,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
          required: ["slug"],
        },
      },

      // ── INFORM SEVERITY INDEX ────────────────────────────────────────────
      {
        name: "list_inform_severity",
        description:
          "INFORM Severity Index — overall severity scores, categories and reliability per crisis. (slug: inform_severity_index)",
        inputSchema: {
          type: "object",
          properties: {
            iso3: { type: "string", description: "ISO3 country code (e.g. AFG)" },
            country: { type: "string", description: "Country name" },
            regions: { type: "string", description: "Region (e.g. Asia, Africa)" },
            crisis_id: { type: "string", description: "Crisis ID (e.g. AFG001)" },
            date: P_DATE,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
        },
      },
      {
        name: "get_inform_severity_component",
        description:
          "A component/sub-dataset of the INFORM Severity Index for a given period. Components: complexity, conditions_of_people_affected, core_indicators, country_indicators, impact_of_crisis, reliability, reliability_indicators, reliability_updated_days, log, country_log.",
        inputSchema: {
          type: "object",
          properties: {
            component: {
              type: "string",
              description: "Which component to fetch",
              enum: ["complexity", "conditions_of_people_affected", "core_indicators", "country_indicators", "impact_of_crisis", "reliability", "reliability_indicators", "reliability_updated_days", "log", "country_log"],
            },
            iso3: { type: "string", description: "ISO3 country code" },
            country: { type: "string", description: "Country name" },
            crisis_id: { type: "string", description: "Crisis ID" },
            date: P_DATE,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
          required: ["component"],
        },
      },

      // ── HUMANITARIAN ACCESS ──────────────────────────────────────────────
      {
        name: "list_humanitarian_access",
        description:
          "Humanitarian Access Overview — access scores/indicators per crisis. View: overview (default), weighted_scores, infogap_weighted_scores, or log.",
        inputSchema: {
          type: "object",
          properties: {
            view: { type: "string", enum: ["overview", "weighted_scores", "infogap_weighted_scores", "log"], description: "Which access view (default overview)", default: "overview" },
            iso3: { type: "string", description: "ISO3 country code" },
            country: { type: "string", description: "Country name" },
            crisis_id: { type: "string", description: "Crisis ID" },
            date: P_DATE,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
        },
      },
      {
        name: "list_humanitarian_access_events",
        description:
          "Humanitarian access events (individual incidents). View: events (default) or events_expand_admin (one row per admin-1 area).",
        inputSchema: {
          type: "object",
          properties: {
            view: { type: "string", enum: ["events", "events_expand_admin"], description: "Which events view (default events)", default: "events" },
            iso3: { type: "string", description: "ISO3 country code" },
            country: { type: "string", description: "Country name" },
            indicator: { type: "string", description: "Access indicator" },
            date_from: P_DATE_FROM,
            date_to: P_DATE_TO,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
        },
      },

      // ── RISK ─────────────────────────────────────────────────────────────
      {
        name: "list_risk_list",
        description: "ACAPS Risk List — monitored risks with rationale, triggers, probability, impact and level. (slug: risk_list)",
        inputSchema: {
          type: "object",
          properties: {
            iso3: { type: "string", description: "ISO3 country code" },
            country: { type: "string", description: "Country name" },
            crisis_id: { type: "string", description: "Crisis ID" },
            risk_level: { type: "string", description: "Risk level (e.g. High, Medium, Low)" },
            risk_type: { type: "string", description: "Risk type" },
            status: { type: "string", description: "Status" },
            date_from: P_DATE_FROM,
            date_to: P_DATE_TO,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
        },
      },
      {
        name: "list_risk_radar",
        description:
          "ACAPS Risk Radar / Risk List (beta) — richer risk & trigger monitoring. Kind: risks (default), triggers, beta_risks, beta_triggers.",
        inputSchema: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["risks", "triggers", "beta_risks", "beta_triggers"], description: "Which risk view (default risks)", default: "risks" },
            iso3: { type: "string", description: "ISO3 country code" },
            country: { type: "string", description: "Country name" },
            crisis_id: { type: "string", description: "Crisis ID" },
            risk_level: { type: "string", description: "Risk level" },
            risk_type: { type: "string", description: "Risk type" },
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
        },
      },

      // ── REFERENCE ────────────────────────────────────────────────────────
      {
        name: "list_countries",
        description: "ACAPS country reference list. (slug: countries)",
        inputSchema: {
          type: "object",
          properties: {
            iso3: { type: "string", description: "ISO3 country code" },
            country: { type: "string", description: "Country name" },
            regions: { type: "string", description: "Region" },
            crises: { type: "string", description: "Filter by crisis" },
            ordering: P_ORDERING,
            filters: P_FILTERS,
          },
        },
      },
      {
        name: "list_crises",
        description: "ACAPS crisis reference list (active and historical crises). (slug: crises)",
        inputSchema: {
          type: "object",
          properties: {
            crisis_id: { type: "string", description: "Crisis ID" },
            crisis_name: { type: "string", description: "Crisis name" },
            iso3: { type: "string", description: "ISO3 country code" },
            country: { type: "string", description: "Country name" },
            regions: { type: "string", description: "Region" },
            active: { type: "string", description: "Active flag (true/false)" },
            drivers: { type: "string", description: "Crisis driver" },
            ordering: P_ORDERING,
            filters: P_FILTERS,
          },
        },
      },

      // ── GLOBAL DATASETS ──────────────────────────────────────────────────
      {
        name: "list_government_measures",
        description: "COVID-19 Government Measures (archived Dec 2020). Note: country-code field is 'iso'. (slug: government_measures)",
        inputSchema: {
          type: "object",
          properties: {
            iso: { type: "string", description: "ISO3 country code (field is 'iso')" },
            country: { type: "string", description: "Country name" },
            region: { type: "string", description: "Region" },
            category: { type: "string", description: "Measure category (e.g. Lockdown)" },
            log_type: { type: "string", description: "Log type" },
            date_implemented: { type: "string", description: "Implementation date (YYYY-MM-DD)" },
            date_from: P_DATE_FROM,
            date_to: P_DATE_TO,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
        },
      },
      {
        name: "list_covid_secondary_impacts",
        description: "COVID-19 Secondary Impacts dataset — indicators on the wider impact of the pandemic. (slug: covid_19_secondary_impacts)",
        inputSchema: {
          type: "object",
          properties: {
            iso3: { type: "string", description: "ISO3 country code" },
            country: { type: "string", description: "Country name" },
            pillar: { type: "string", description: "Pillar" },
            indicator: { type: "string", description: "Indicator" },
            date_from: P_DATE_FROM,
            date_to: P_DATE_TO,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
        },
      },
      {
        name: "list_daily_monitoring",
        description: "ACAPS daily monitoring picks — noteworthy developments tracked day-to-day. (slug: daily_monitoring)",
        inputSchema: {
          type: "object",
          properties: {
            iso3: { type: "string", description: "ISO3 country code" },
            country: { type: "string", description: "Country name" },
            date_from: P_DATE_FROM,
            date_to: P_DATE_TO,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
        },
      },
      {
        name: "list_information_landscape",
        description: "Information Landscape dataset — information gaps/coverage by country and admin-1. (slug: information_landscape_dataset)",
        inputSchema: {
          type: "object",
          properties: {
            iso3: { type: "string", description: "ISO3 country code" },
            country: { type: "string", description: "Country name" },
            indicator: { type: "string", description: "Indicator" },
            date_from: P_DATE_FROM,
            date_to: P_DATE_TO,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
        },
      },
      {
        name: "list_protection_risks",
        description: "Protection Risks Monitor — protection risks by country and admin-1. (slug: protection_risks_monitor)",
        inputSchema: {
          type: "object",
          properties: {
            iso3: { type: "string", description: "ISO3 country code" },
            country: { type: "string", description: "Country name" },
            protection_risk: { type: "string", description: "Protection risk type" },
            date_from: P_DATE_FROM,
            date_to: P_DATE_TO,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
        },
      },
      {
        name: "list_seasonal_calendar",
        description: "Seasonal Events Calendar — seasonal events (harvests, lean seasons, hazards) by country/admin-1. (slug: seasonal_events_calendar_seasonal_calendar)",
        inputSchema: {
          type: "object",
          properties: {
            iso: { type: "string", description: "ISO3 country code (field is 'iso')" },
            country: { type: "string", description: "Country name" },
            event_type: { type: "string", description: "Event type" },
            event: { type: "string", description: "Event name" },
            ordering: P_ORDERING,
            filters: P_FILTERS,
          },
        },
      },

      // ── COUNTRY PROGRAMMES ───────────────────────────────────────────────
      {
        name: "get_afghanistan_dataset",
        description: "Afghanistan core datasets. table: " + AFG_TABLES.join(", ") + ".",
        inputSchema: {
          type: "object",
          properties: {
            table: { type: "string", enum: AFG_TABLES, description: "Which Afghanistan core dataset" },
            admin1: { type: "string", description: "Admin-1 name" },
            date_from: P_DATE_FROM,
            date_to: P_DATE_TO,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
          required: ["table"],
        },
      },
      {
        name: "get_yemen_dataset",
        description: "Yemen datasets. table: " + YEMEN_TABLES.join(", ") + ". ('monitoring' and 'monitoring_indicators' are the Yemen Monitoring dataset; the rest are core-dataset tables.)",
        inputSchema: {
          type: "object",
          properties: {
            table: { type: "string", enum: YEMEN_TABLES, description: "Which Yemen dataset/table" },
            governorate: { type: "string", description: "Governorate (core-dataset tables)" },
            date_from: P_DATE_FROM,
            date_to: P_DATE_TO,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
          required: ["table"],
        },
      },
      {
        name: "get_ukraine_dataset",
        description: "Ukraine datasets. table: " + UKRAINE_TABLES.join(", ") + ". (master_dataset, regional_dataset, subnational_access and subnational_access_raion accept a historical 'date'.)",
        inputSchema: {
          type: "object",
          properties: {
            table: { type: "string", enum: UKRAINE_TABLES, description: "Which Ukraine dataset" },
            oblast: { type: "string", description: "Oblast (where applicable)" },
            indicator: { type: "string", description: "Indicator (where applicable)" },
            date: P_DATE,
            date_from: P_DATE_FROM,
            date_to: P_DATE_TO,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
          required: ["table"],
        },
      },
      {
        name: "get_turkiye_syria_dataset",
        description: "Türkiye–Syria earthquake datasets. table: " + TSQ_TABLES.join(", ") + ". (humanitarian_access and inform_severity_index accept a historical 'date'.)",
        inputSchema: {
          type: "object",
          properties: {
            table: { type: "string", enum: TSQ_TABLES, description: "Which Türkiye–Syria earthquake dataset" },
            iso3: { type: "string", description: "ISO3 country code (where applicable)" },
            date: P_DATE,
            ordering: P_ORDERING,
            page: P_PAGE,
            filters: P_FILTERS,
          },
          required: ["table"],
        },
      },
    ],
  };
});

// --- TOOL EXECUTION ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    let result;

    switch (name) {
      case "list_acaps_datasets": {
        const includeFields = args.fields !== false;
        const rows = Object.entries(REGISTRY)
          .filter(([, v]) => !args.group || v.group === args.group)
          .map(([slug, v]) => ({
            slug,
            group: v.group,
            name: v.name,
            path: v.path,
            takes_date: v.dated,
            ...(includeFields ? { fields: v.fields } : {}),
          }));
        result = {
          base_url: `${BASE_URL}/api/v1/`,
          auth: "Token auth via ACAPS_USERNAME / ACAPS_PASSWORD in .env",
          pagination: "100 results per page; use 'page'. 'next' gives the next page URL.",
          historical: "Datasets flagged takes_date accept a period like Jan2024 (omit for latest).",
          total: rows.length,
          datasets: rows,
        };
        break;
      }

      case "acaps_request":
        result = await callSlug(args.slug, {
          date: args.date,
          ordering: args.ordering,
          page: args.page,
          filters: args.filters,
        });
        break;

      // INFORM SEVERITY
      case "list_inform_severity":
        result = await callSlug("inform_severity_index", {
          date: args.date, ordering: args.ordering, page: args.page, filters: args.filters,
          explicit: { iso3: args.iso3, country: args.country, regions: args.regions, crisis_id: args.crisis_id },
        });
        break;
      case "get_inform_severity_component":
        result = await callSlug(`inform_severity_index_${args.component}`, {
          date: args.date, ordering: args.ordering, page: args.page, filters: args.filters,
          explicit: { iso3: args.iso3, country: args.country, crisis_id: args.crisis_id },
        });
        break;

      // HUMANITARIAN ACCESS
      case "list_humanitarian_access": {
        const map = {
          overview: "humanitarian_access",
          weighted_scores: "humanitarian_access_weighted_scores",
          infogap_weighted_scores: "humanitarian_access_infogap_weighted_scores",
          log: "humanitarian_access_log",
        };
        result = await callSlug(map[args.view || "overview"], {
          date: args.date, ordering: args.ordering, page: args.page, filters: args.filters,
          explicit: { iso3: args.iso3, country: args.country, crisis_id: args.crisis_id },
        });
        break;
      }
      case "list_humanitarian_access_events": {
        const map = { events: "humanitarian_access_events", events_expand_admin: "humanitarian_access_events_expand_admin" };
        result = await callSlug(map[args.view || "events"], {
          ordering: args.ordering, page: args.page, date_from: args.date_from, date_to: args.date_to, filters: args.filters,
          explicit: { iso3: args.iso3, country: args.country, indicator: args.indicator },
        });
        break;
      }

      // RISK
      case "list_risk_list":
        result = await callSlug("risk_list", {
          ordering: args.ordering, page: args.page, date_from: args.date_from, date_to: args.date_to, filters: args.filters,
          explicit: { iso3: args.iso3, country: args.country, crisis_id: args.crisis_id, risk_level: args.risk_level, risk_type: args.risk_type, status: args.status },
        });
        break;
      case "list_risk_radar": {
        const map = {
          risks: "risk_radar_risk_radar",
          triggers: "risk_radar_trigger_list",
          beta_risks: "risk_list_beta_testing_risk_list_beta_testing",
          beta_triggers: "risk_list_beta_testing_trigger_list_beta_testing",
        };
        result = await callSlug(map[args.kind || "risks"], {
          ordering: args.ordering, page: args.page, filters: args.filters,
          explicit: { iso3: args.iso3, country: args.country, crisis_id: args.crisis_id, risk_level: args.risk_level, risk_type: args.risk_type },
        });
        break;
      }

      // REFERENCE
      case "list_countries":
        result = await callSlug("countries", {
          ordering: args.ordering, filters: args.filters,
          explicit: { iso3: args.iso3, country: args.country, regions: args.regions, crises: args.crises },
        });
        break;
      case "list_crises":
        result = await callSlug("crises", {
          ordering: args.ordering, filters: args.filters,
          explicit: { crisis_id: args.crisis_id, crisis_name: args.crisis_name, iso3: args.iso3, country: args.country, regions: args.regions, active: args.active, drivers: args.drivers },
        });
        break;

      // GLOBAL DATASETS
      case "list_government_measures":
        result = await callSlug("government_measures", {
          ordering: args.ordering, page: args.page, date_from: args.date_from, date_to: args.date_to, filters: args.filters,
          explicit: { iso: args.iso, country: args.country, region: args.region, category: args.category, log_type: args.log_type, date_implemented: args.date_implemented },
        });
        break;
      case "list_covid_secondary_impacts":
        result = await callSlug("covid_19_secondary_impacts", {
          ordering: args.ordering, page: args.page, date_from: args.date_from, date_to: args.date_to, filters: args.filters,
          explicit: { iso3: args.iso3, country: args.country, pillar: args.pillar, indicator: args.indicator },
        });
        break;
      case "list_daily_monitoring":
        result = await callSlug("daily_monitoring", {
          ordering: args.ordering, page: args.page, date_from: args.date_from, date_to: args.date_to, filters: args.filters,
          explicit: { iso3: args.iso3, country: args.country },
        });
        break;
      case "list_information_landscape":
        result = await callSlug("information_landscape_dataset", {
          ordering: args.ordering, page: args.page, date_from: args.date_from, date_to: args.date_to, filters: args.filters,
          explicit: { iso3: args.iso3, country: args.country, indicator: args.indicator },
        });
        break;
      case "list_protection_risks":
        result = await callSlug("protection_risks_monitor", {
          ordering: args.ordering, page: args.page, date_from: args.date_from, date_to: args.date_to, filters: args.filters,
          explicit: { iso3: args.iso3, country: args.country, protection_risk: args.protection_risk },
        });
        break;
      case "list_seasonal_calendar":
        result = await callSlug("seasonal_events_calendar_seasonal_calendar", {
          ordering: args.ordering, filters: args.filters,
          explicit: { iso: args.iso, country: args.country, event_type: args.event_type, event: args.event },
        });
        break;

      // COUNTRY PROGRAMMES
      case "get_afghanistan_dataset":
        if (!AFG_TABLES.includes(args.table)) throw new Error(`Invalid table. Options: ${AFG_TABLES.join(", ")}`);
        result = await callSlug(`afghanistan_core_dataset_${args.table}`, {
          ordering: args.ordering, page: args.page, date_from: args.date_from, date_to: args.date_to, filters: args.filters,
          explicit: { admin1: args.admin1 },
        });
        break;
      case "get_yemen_dataset": {
        if (!YEMEN_TABLES.includes(args.table)) throw new Error(`Invalid table. Options: ${YEMEN_TABLES.join(", ")}`);
        const slug = args.table === "monitoring" ? "yemen_monitoring"
          : args.table === "monitoring_indicators" ? "yemen_monitoring_indicators"
          : `yemen_core_dataset_${args.table}`;
        result = await callSlug(slug, {
          ordering: args.ordering, page: args.page, date_from: args.date_from, date_to: args.date_to, filters: args.filters,
          explicit: { governorate: args.governorate },
        });
        break;
      }
      case "get_ukraine_dataset":
        if (!UKRAINE_TABLES.includes(args.table)) throw new Error(`Invalid table. Options: ${UKRAINE_TABLES.join(", ")}`);
        result = await callSlug(`ukraine_${args.table}`, {
          date: args.date, ordering: args.ordering, page: args.page, date_from: args.date_from, date_to: args.date_to, filters: args.filters,
          explicit: { oblast: args.oblast, indicator: args.indicator },
        });
        break;
      case "get_turkiye_syria_dataset":
        if (!TSQ_TABLES.includes(args.table)) throw new Error(`Invalid table. Options: ${TSQ_TABLES.join(", ")}`);
        result = await callSlug(`turkiye_syria_earthquake_${args.table}`, {
          date: args.date, ordering: args.ordering, page: args.page, filters: args.filters,
          explicit: { iso3: args.iso3 },
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
  if (!ACAPS_USERNAME || !ACAPS_PASSWORD) {
    console.error("FATAL: Cannot start server. Missing ACAPS_USERNAME / ACAPS_PASSWORD in .env file.");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`ACAPS MCP Server v2.0.0 running on stdio — ${Object.keys(REGISTRY).length} datasets (credentials from .env)`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
