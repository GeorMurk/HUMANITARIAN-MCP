/**
 * ACLED API MCP Server
 *
 * Exposes the ACLED (Armed Conflict Location & Event Data) API as MCP tools.
 * Docs: https://acleddata.com/acled-api-documentation
 *
 * REQUIREMENTS:
 * 1. Create a .env file in the same folder containing:
 *      ACLED_USERNAME=your_acled_account_email
 *      ACLED_PASSWORD=your_acled_account_password
 *    (Register a free account at https://acleddata.com/register/)
 * 2. Run 'node server.js'
 *
 * AUTH:
 *   ACLED uses OAuth2 (password grant). The server POSTs the credentials to
 *   /oauth/token to obtain a Bearer access token (valid 24h), caches it, and
 *   sends "Authorization: Bearer <token>" on every request. On a 401/403 the
 *   token is refreshed once and the request retried.
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

const ACLED_USERNAME = process.env.ACLED_USERNAME;
const ACLED_PASSWORD = process.env.ACLED_PASSWORD;
const BASE_URL = "https://acleddata.com";
// A browser-like User-Agent is required; the default axios UA is blocked by
// ACLED's Cloudflare bot protection (returns a "Just a moment..." challenge).
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
  { name: "acled-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// --- AUTH (OAuth2 password grant) ---
let cachedToken = null;

async function fetchToken() {
  if (!ACLED_USERNAME || !ACLED_PASSWORD) {
    throw new Error(
      "ERROR: ACLED_USERNAME / ACLED_PASSWORD not found. Please check your .env file."
    );
  }
  try {
    // ACLED's /oauth/token expects an application/x-www-form-urlencoded body.
    const body = new URLSearchParams({
      username: ACLED_USERNAME,
      password: ACLED_PASSWORD,
      grant_type: "password",
      client_id: "acled",
      scope: "authenticated",
    });
    const response = await axios.post(
      `${BASE_URL}/oauth/token`,
      body.toString(),
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        timeout: 15000,
      }
    );
    if (!response.data || !response.data.access_token) {
      throw new Error("Auth response did not contain an access_token.");
    }
    return response.data.access_token;
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
async function callAcledApi(endpoint, params = {}) {
  // Remove undefined/null/empty params
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(
      ([_, v]) => v !== undefined && v !== null && v !== ""
    )
  );
  // ACLED returns richer JSON (with metadata) by default; be explicit.
  if (cleanParams._format === undefined) cleanParams._format = "json";

  const doRequest = async (token) =>
    axios.get(`${BASE_URL}${endpoint}`, {
      params: cleanParams,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
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

// --- TOOL DEFINITIONS ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [

      // ── MAIN EVENT DATA ─────────────────────────────────────────────────────
      {
        name: "get_acled_events",
        description:
          "Query ACLED conflict/protest event data (battles, protests, riots, violence against civilians, explosions/remote violence, strategic developments). Supports rich filtering. (Docs: /api/acled/read)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "string", description: "Country/territory name(s). Use '|' to OR multiple, e.g. 'Kenya|Uganda'." },
            iso: { type: "string", description: "Numeric ISO 3166 country code (e.g. 404 for Kenya)." },
            region: { type: "string", description: "Numeric ACLED region code (e.g. 3=Eastern Africa, 1=Western Africa, 10=Middle East). '|' to OR." },
            year: { type: "integer", description: "Filter by a single year (e.g. 2024). For a range use year_from/year_to." },
            year_from: { type: "integer", description: "Start year for a BETWEEN range (used with year_to)." },
            year_to: { type: "integer", description: "End year for a BETWEEN range (used with year_from)." },
            date_from: { type: "string", description: "Earliest event_date (YYYY-MM-DD). Used with date_to as a BETWEEN range." },
            date_to: { type: "string", description: "Latest event_date (YYYY-MM-DD). Used with date_from." },
            event_type: { type: "string", description: "Event type, e.g. 'Battles', 'Protests', 'Riots', 'Violence against civilians', 'Explosions/Remote violence', 'Strategic developments'. '|' to OR." },
            sub_event_type: { type: "string", description: "Sub-event type, e.g. 'Armed clash', 'Peaceful protest', 'Attack'." },
            disorder_type: { type: "string", description: "Disorder category, e.g. 'Political violence', 'Demonstrations', 'Strategic developments'." },
            actor1: { type: "string", description: "Primary actor name (partial match / LIKE)." },
            actor2: { type: "string", description: "Secondary actor name (partial match / LIKE)." },
            admin1: { type: "string", description: "Primary sub-national admin division name (partial match / LIKE)." },
            admin2: { type: "string", description: "Secondary sub-national admin division name (partial match / LIKE)." },
            location: { type: "string", description: "Specific location name (partial match / LIKE)." },
            civilian_targeting: { type: "string", description: "Set to 'Civilian targeting' to return only civilian-targeting events." },
            fatalities_min: { type: "integer", description: "Only events with fatalities greater than this number." },
            fields: { type: "string", description: "Pipe-separated columns to return, e.g. 'event_date|country|event_type|fatalities'. Omit for all fields." },
            limit: { type: "integer", description: "Max rows to return (default 50; use 0 for all matching rows).", default: 50 },
            page: { type: "integer", description: "Page number for pagination (each page returns up to 'limit' rows)." },
          },
        },
      },

      // ── DELETED EVENTS ──────────────────────────────────────────────────────
      {
        name: "get_deleted_events",
        description:
          "List event IDs that have been deleted from the ACLED dataset (for keeping a local mirror in sync). (Docs: /api/deleted/read)",
        inputSchema: {
          type: "object",
          properties: {
            deleted_timestamp: { type: "string", description: "Return events deleted at/after this Unix timestamp or YYYY-MM-DD date." },
            limit: { type: "integer", description: "Max rows to return (default 50).", default: 50 },
            page: { type: "integer", description: "Page number for pagination." },
          },
        },
      },

      // ── CAST FORECAST ───────────────────────────────────────────────────────
      {
        name: "get_cast_forecast",
        description:
          "Query ACLED CAST (Conflict Alert System) monthly conflict forecasts and observed values by country. (Docs: /api/cast/read)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "string", description: "Country/territory name(s). '|' to OR multiple." },
            iso: { type: "string", description: "Numeric ISO 3166 country code." },
            region: { type: "string", description: "Numeric ACLED region code." },
            year: { type: "integer", description: "Filter by year." },
            month: { type: "integer", description: "Filter by month number (1-12)." },
            limit: { type: "integer", description: "Max rows to return (default 50).", default: 50 },
            page: { type: "integer", description: "Page number for pagination." },
          },
        },
      },

      // ── REFERENCE / LOOKUP ──────────────────────────────────────────────────
      {
        name: "list_actors",
        description:
          "Look up ACLED actors (armed groups, protesters, state forces, etc.) by name. Returns actor id (mal_actor_id) and label. Useful to find exact actor names to filter events. (Docs: /api/actor/read)",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Actor name to search for (partial match / LIKE), e.g. 'Shabaab'." },
            limit: { type: "integer", description: "Max rows to return (default 25).", default: 25 },
            page: { type: "integer", description: "Page number for pagination." },
          },
        },
      },
      {
        name: "list_actor_types",
        description:
          "List ACLED actor type categories (e.g. 'State forces', 'Rebel group', 'Political militia', 'Protesters', 'Civilians'). (Docs: /api/actortype/read)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max rows to return (default 50).", default: 50 },
          },
        },
      },
      {
        name: "list_countries",
        description:
          "List ACLED country reference data: name, ISO 2-letter, ISO3, and numeric ISO code. Useful to resolve the numeric 'iso' code used to filter events. (Docs: /api/country/read)",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Country name to search for (partial match / LIKE), e.g. 'Kenya'." },
            limit: { type: "integer", description: "Max rows to return (default 300 to return all).", default: 300 },
          },
        },
      },
      {
        name: "list_regions",
        description:
          "List ACLED world regions in order. The region's position in this list (1-based) is the numeric 'region' code used to filter events (1=Western Africa, 3=Eastern Africa, 8=Middle East, ...). (Docs: /api/region/read)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max rows to return (default 50).", default: 50 },
          },
        },
      },

      // ── GENERIC PASSTHROUGH ─────────────────────────────────────────────────
      {
        name: "acled_request",
        description:
          "Advanced/raw ACLED API request. Call any read endpoint with arbitrary query parameters (including '_where' operator suffixes like year_where=BETWEEN). Use when the dedicated tools don't expose a needed filter. (Docs: https://acleddata.com/api-documentation/elements-acleds-api)",
        inputSchema: {
          type: "object",
          properties: {
            endpoint: { type: "string", description: "API path, e.g. '/api/acled/read', '/api/deleted/read', '/api/cast/read'." },
            params: { type: "object", description: "Object of raw query-string name/value pairs, e.g. { country: 'Argentina', year: '2019|2022', year_where: 'BETWEEN', limit: 100 }." },
          },
          required: ["endpoint"],
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

      case "get_acled_events": {
        const params = {
          country: args.country,
          iso: args.iso,
          region: args.region,
          event_type: args.event_type,
          sub_event_type: args.sub_event_type,
          disorder_type: args.disorder_type,
          actor1: args.actor1,
          actor2: args.actor2,
          admin1: args.admin1,
          admin2: args.admin2,
          location: args.location,
          civilian_targeting: args.civilian_targeting,
          fields: args.fields,
          limit: args.limit !== undefined ? args.limit : 50,
          page: args.page,
        };
        // Year: single, or BETWEEN range.
        if (args.year_from !== undefined && args.year_to !== undefined) {
          params.year = `${args.year_from}|${args.year_to}`;
          params.year_where = "BETWEEN";
        } else if (args.year !== undefined) {
          params.year = args.year;
        }
        // Event date BETWEEN range.
        if (args.date_from && args.date_to) {
          params.event_date = `${args.date_from}|${args.date_to}`;
          params.event_date_where = "BETWEEN";
        } else if (args.date_from) {
          params.event_date = args.date_from;
          params.event_date_where = ">=";
        } else if (args.date_to) {
          params.event_date = args.date_to;
          params.event_date_where = "<=";
        }
        // Fatalities minimum.
        if (args.fatalities_min !== undefined) {
          params.fatalities = args.fatalities_min;
          params.fatalities_where = ">";
        }
        result = await callAcledApi("/api/acled/read", params);
        break;
      }

      case "get_deleted_events":
        result = await callAcledApi("/api/deleted/read", {
          deleted_timestamp: args.deleted_timestamp,
          limit: args.limit !== undefined ? args.limit : 50,
          page: args.page,
        });
        break;

      case "get_cast_forecast":
        result = await callAcledApi("/api/cast/read", {
          country: args.country,
          iso: args.iso,
          region: args.region,
          year: args.year,
          month: args.month,
          limit: args.limit !== undefined ? args.limit : 50,
          page: args.page,
        });
        break;

      case "list_actors":
        result = await callAcledApi("/api/actor/read", {
          label: args.name,
          limit: args.limit !== undefined ? args.limit : 25,
          page: args.page,
        });
        break;

      case "list_actor_types":
        result = await callAcledApi("/api/actortype/read", {
          limit: args.limit !== undefined ? args.limit : 50,
        });
        break;

      case "list_countries":
        result = await callAcledApi("/api/country/read", {
          name: args.name,
          limit: args.limit !== undefined ? args.limit : 300,
        });
        break;

      case "list_regions":
        result = await callAcledApi("/api/region/read", {
          limit: args.limit !== undefined ? args.limit : 50,
        });
        break;

      case "acled_request":
        result = await callAcledApi(args.endpoint, args.params || {});
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
  if (!ACLED_USERNAME || !ACLED_PASSWORD) {
    console.error(
      "FATAL: Cannot start server. Missing ACLED_USERNAME / ACLED_PASSWORD in .env file."
    );
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ACLED MCP Server v1.0.0 running on stdio (OAuth credentials loaded from .env)");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
