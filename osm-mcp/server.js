/**
 * OpenStreetMap MCP Server
 *
 * Covers the read-side data access APIs described at
 * https://wiki.openstreetmap.org/wiki/Databases_and_data_access_APIs
 *
 *   - Overpass API      read-only query service, the right tool for most lookups
 *   - Main API v0.6     live editing database (read endpoints only here; bbox < 0.25 sq deg)
 *   - Nominatim         search / geocoding built on the nominatim schema
 *   - Taginfo           tag discovery, so queries can be built with real keys and values
 *   - Bulk sources      Planet.osm, Geofabrik, slice.osm.us, Open Planet Data (links only)
 *
 * This server is deliberately READ-ONLY. Every read endpoint in the API v0.6
 * specification is implemented; no write endpoint is. Specifically excluded:
 *
 *   Changesets  create, update, close, diff upload, comment, (un)subscribe
 *   Elements    create (POST), update (PUT), delete (DELETE)
 *   Notes       create, comment, close, reopen, (un)subscribe
 *   GPS traces  upload, update, delete
 *   Preferences PUT and DELETE (the GET is implemented)
 *   Moderator   element redaction, hide/unhide changeset comment, hide note,
 *               create user block
 *
 * Those endpoints modify the live global map. Adding them would mean an agent
 * could alter or delete real geometry, which is hard to reverse and, per the
 * API usage policy, can get the account blocked. Automated edits also fall
 * under the Automated Edits code of conduct. Use a real editor (iD, JOSM) for
 * changes: https://wiki.openstreetmap.org/wiki/Automated_Edits_code_of_conduct
 *
 * XAPI is exposed only through Overpass's compatibility layer - the wiki page
 * records the original service as retired and replaced by Overpass.
 *
 * REQUIREMENTS:
 * 1. No API key is needed for the vast majority of tools - the OSM read APIs,
 *    Overpass, Nominatim and Taginfo are all public.
 * 2. Optionally set OSM_USER_AGENT in a .env file to identify your application,
 *    as the OSM and Nominatim usage policies require.
 * 3. Optionally set OSM_ACCESS_TOKEN to an OAuth 2.0 bearer token to unlock the
 *    six account-scoped read endpoints (own profile, preferences, GPS traces,
 *    active blocks). Read scopes only - read_prefs and read_gpx are enough.
 * 4. Run 'node server.js'
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

// The OSM and Nominatim usage policies both require a descriptive User-Agent.
const USER_AGENT =
  process.env.OSM_USER_AGENT ||
  "osm-mcp/1.0 (OpenStreetMap MCP server; https://wiki.openstreetmap.org/wiki/Databases_and_data_access_APIs)";

const OSM_API_BASE = process.env.OSM_API_BASE || "https://api.openstreetmap.org";

// Optional. An OAuth 2.0 bearer token unlocks the endpoints that are tied to a
// specific account: your own profile, preferences, GPS traces and active blocks.
// Everything else in this server works anonymously.
const OSM_ACCESS_TOKEN = process.env.OSM_ACCESS_TOKEN || "";

// The public Overpass instance sheds load with 429/504 under pressure, so we
// retry. OVERPASS_API_URL may list several comma-separated endpoints (e.g. a
// mirror such as https://overpass.kumi.systems/api/interpreter) to fail over to.
const OVERPASS_URLS = (process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);
const OVERPASS_URL = OVERPASS_URLS[0];
const NOMINATIM_BASE = process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
const TAGINFO_BASE = process.env.TAGINFO_BASE_URL || "https://taginfo.openstreetmap.org";

// Overpass can legitimately run for minutes; the HTTP timeout must exceed the
// [timeout:] value baked into the query itself.
const OVERPASS_HTTP_TIMEOUT_MS = parseInt(process.env.OVERPASS_HTTP_TIMEOUT_MS || "120000", 10);
const DEFAULT_OVERPASS_TIMEOUT = parseInt(process.env.OVERPASS_QUERY_TIMEOUT || "60", 10);
const OVERPASS_RETRIES = parseInt(process.env.OVERPASS_RETRIES || "4", 10);
const OSM_API_RETRIES = parseInt(process.env.OSM_API_RETRIES || "3", 10);

// OSM payloads get very large very fast; cap what we hand back to the model.
const MAX_RESPONSE_CHARS = parseInt(process.env.OSM_MAX_RESPONSE_CHARS || "120000", 10);

// Server-declared limits, from https://api.openstreetmap.org/api/capabilities
const MAX_MAP_AREA_SQ_DEG = 0.25;
const MAX_NOTE_AREA_SQ_DEG = 25;

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
  { name: "osm-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// --- HTTP HELPERS -----------------------------------------------------------

function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params || {}).filter(([_, v]) => v !== undefined && v !== null && v !== "")
  );
}

function describeAxiosError(error, service) {
  if (error.response) {
    const body = error.response.data;
    const text = typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500);
    return new Error(`${service} error ${error.response.status}: ${text}`);
  }
  if (error.code === "ECONNABORTED") {
    return new Error(`${service} request timed out. Narrow the query area or raise the timeout.`);
  }
  return new Error(`${service} request failed: ${error.message}`);
}

/**
 * Main API v0.6. Appending .json to the path gets JSON instead of OSM XML.
 * The live API occasionally stalls under load, so retry timeouts and 5xx once
 * or twice - a 404 or 410 (deleted element) is final and returns immediately.
 */
async function callOsmApi(endpoint, params = {}, options = {}) {
  if (options.requiresAuth && !OSM_ACCESS_TOKEN) {
    throw new Error(
      "This endpoint is tied to a specific OSM account and needs authentication. Set OSM_ACCESS_TOKEN " +
      `in your .env to an OAuth 2.0 bearer token with the ${options.scope || "required"} scope. ` +
      "Register an OAuth 2 application at https://www.openstreetmap.org/oauth2/applications to get one."
    );
  }
  const headers = { "User-Agent": USER_AGENT, Accept: "application/json, text/xml" };
  if (OSM_ACCESS_TOKEN) headers.Authorization = `Bearer ${OSM_ACCESS_TOKEN}`;

  let lastError;
  for (let attempt = 0; attempt < OSM_API_RETRIES; attempt++) {
    try {
      const response = await axios.get(`${OSM_API_BASE}${endpoint}`, {
        params: cleanParams(params),
        headers,
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      const status = error.response && error.response.status;
      const retryable = !status || status === 429 || status >= 500;
      if (!retryable) throw describeAxiosError(error, "OSM API");
      lastError = error;
      if (attempt < OSM_API_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw describeAxiosError(lastError, "OSM API");
}

/**
 * Overpass wants the query form-encoded in a POST body under `data`.
 *
 * The public instance rate-limits (429) and sheds load (502/503/504) routinely,
 * and those failures are transient - the same query succeeds moments later. Walk
 * the configured endpoints, backing off between attempts.
 */
async function callOverpass(query) {
  return throttleOverpass(async () => {
    const attempts = [];
    for (let round = 0; round < OVERPASS_RETRIES; round++) {
      for (const url of OVERPASS_URLS) {
        try {
          const response = await axios.post(url, new URLSearchParams({ data: query }).toString(), {
            headers: {
              "User-Agent": USER_AGENT,
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
            },
            timeout: OVERPASS_HTTP_TIMEOUT_MS,
          });
          return response.data;
        } catch (error) {
          const status = error.response && error.response.status;
          const retryable = !status || [429, 500, 502, 503, 504].includes(status);
          attempts.push(`${url} -> ${status || error.code || error.message}`);
          if (!retryable) throw describeAxiosError(error, "Overpass API");
        }
      }
      if (round < OVERPASS_RETRIES - 1) {
        // A 429 means every query slot is busy; those take seconds to free up.
        await new Promise((r) => setTimeout(r, 5000 * Math.pow(2, round)));
      }
    }
    throw new Error(
      `Overpass API unavailable after ${OVERPASS_RETRIES} rounds (${attempts.join("; ")}). ` +
      `The public instance rate-limits busy clients - check overpass_status, wait a moment, or set ` +
      `OVERPASS_API_URL to a mirror.`
    );
  });
}

/**
 * Overpass's XAPI Compatibility Layer, for legacy XAPI predicates. Returns OSM XML.
 * Deliberately uses only the first configured endpoint rather than walking
 * OVERPASS_URLS: the compatibility layer is optional and not every mirror
 * enables it, so failing over would just swap one error for a confusing 404.
 */
async function callXapi(predicate) {
  const xapiUrl = OVERPASS_URL.replace(/\/interpreter\/?$/, "/xapi");
  return throttleOverpass(async () => {
    try {
      const response = await axios.get(`${xapiUrl}?${predicate}`, {
        headers: { "User-Agent": USER_AGENT },
        timeout: OVERPASS_HTTP_TIMEOUT_MS,
      });
      return response.data;
    } catch (error) {
      throw describeAxiosError(error, "Overpass XAPI layer");
    }
  });
}

/** Overpass /api/status: rate limit and free query slots. Plain text, not JSON. */
async function callOverpassStatus() {
  const statusUrl = OVERPASS_URL.replace(/\/interpreter\/?$/, "/status");
  try {
    const response = await axios.get(statusUrl, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 20000,
    });
    return response.data;
  } catch (error) {
    throw describeAxiosError(error, "Overpass API");
  }
}

/**
 * Serialize calls to a backend and keep a minimum gap between them. Both public
 * services throttle per IP - Nominatim's policy is one request per second, and
 * Overpass allocates a small number of concurrent query slots and answers 429
 * once they are full - so overlapping requests are counterproductive.
 */
function makeThrottle(minGapMs) {
  let chain = Promise.resolve();
  let last = 0;
  return function throttle(fn) {
    const run = chain.then(async () => {
      const wait = minGapMs - (Date.now() - last);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        return await fn();
      } finally {
        last = Date.now();
      }
    });
    // Keep the chain alive even when a call rejects.
    chain = run.catch(() => {});
    return run;
  };
}

const throttleNominatim = makeThrottle(1100);
const throttleOverpass = makeThrottle(1000);

async function callNominatim(endpoint, params = {}) {
  return throttleNominatim(async () => {
    try {
      const response = await axios.get(`${NOMINATIM_BASE}${endpoint}`, {
        params: cleanParams({ format: "jsonv2", ...params }),
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      throw describeAxiosError(error, "Nominatim");
    }
  });
}

async function callTaginfo(endpoint, params = {}) {
  try {
    const response = await axios.get(`${TAGINFO_BASE}${endpoint}`, {
      params: cleanParams(params),
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    throw describeAxiosError(error, "Taginfo");
  }
}

// --- OVERPASS QL BUILDER ----------------------------------------------------

function osmEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Turn a {key: value} map into Overpass tag filters. Value prefixes:
 *   "*" or ""  -> key exists              ["key"]
 *   "~re"      -> value matches regex     ["key"~"re"]
 *   "!~re"     -> value fails regex       ["key"!~"re"]
 *   "!v"       -> value is not v          ["key"!="v"]
 *   otherwise  -> exact match             ["key"="v"]
 */
function buildTagFilters(tags, rawFilter) {
  let filters = "";
  if (tags && typeof tags === "object") {
    for (const [key, value] of Object.entries(tags)) {
      const k = osmEscape(key);
      if (value === undefined || value === null || value === "" || value === "*") {
        filters += `["${k}"]`;
        continue;
      }
      const s = String(value);
      if (s.startsWith("!~")) filters += `["${k}"!~"${osmEscape(s.slice(2))}"]`;
      else if (s.startsWith("~")) filters += `["${k}"~"${osmEscape(s.slice(1))}"]`;
      else if (s.startsWith("!")) filters += `["${k}"!="${osmEscape(s.slice(1))}"]`;
      else filters += `["${k}"="${osmEscape(s)}"]`;
    }
  }
  if (rawFilter) filters += rawFilter;
  return filters;
}

function parseBbox(bbox) {
  const parts = String(bbox).split(",").map((p) => parseFloat(p.trim()));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid bbox "${bbox}". Expected "south,west,north,east" in decimal degrees.`);
  }
  const [south, west, north, east] = parts;
  if (south >= north) throw new Error(`Invalid bbox: south (${south}) must be less than north (${north}).`);
  if (west >= east) throw new Error(`Invalid bbox: west (${west}) must be less than east (${east}).`);
  return { south, west, north, east, area: (north - south) * (east - west) };
}

/**
 * Compose an Overpass QL query from structured filters. Spatial scope is one of
 * area_osm_id, area_name, around, or bbox - checked in that order.
 */
function buildOverpassQuery(args, outMode) {
  const timeout = args.timeout || DEFAULT_OVERPASS_TIMEOUT;
  const filters = buildTagFilters(args.tags, args.raw_filter);
  if (!filters) {
    throw new Error("At least one tag filter is required (e.g. tags: {\"amenity\": \"hospital\"}).");
  }

  let prefix = "";
  let spatial = "";

  if (args.area_osm_id) {
    // Overpass area ids: relation id + 3600000000, way id + 2400000000.
    const offset = args.area_osm_type === "way" ? 2400000000 : 3600000000;
    prefix = `area(${offset + Number(args.area_osm_id)})->.searchArea;\n`;
    spatial = "(area.searchArea)";
  } else if (args.area_name) {
    prefix = `area["name"="${osmEscape(args.area_name)}"]->.searchArea;\n`;
    spatial = "(area.searchArea)";
  } else if (args.lat !== undefined && args.lon !== undefined) {
    const radius = args.radius_m || 1000;
    spatial = `(around:${radius},${args.lat},${args.lon})`;
  } else if (args.bbox) {
    const b = parseBbox(args.bbox);
    spatial = `(${b.south},${b.west},${b.north},${b.east})`;
  } else {
    throw new Error(
      "A spatial scope is required: pass bbox, or lat+lon (+radius_m), or area_name, or area_osm_id. " +
      "Unbounded queries are rejected by the public Overpass instance."
    );
  }

  const types = Array.isArray(args.element_types) && args.element_types.length
    ? args.element_types
    : ["node", "way", "relation"];
  const valid = types.filter((t) => ["node", "way", "relation"].includes(t));
  if (!valid.length) throw new Error(`Invalid element_types: ${JSON.stringify(args.element_types)}`);

  // nwr is Overpass shorthand for all three primitive types.
  const selectors = valid.length === 3
    ? [`nwr${filters}${spatial};`]
    : valid.map((t) => `  ${t}${filters}${spatial};`);

  const body = valid.length === 3 ? selectors[0] : `(\n${selectors.join("\n")}\n);`;

  let out;
  if (outMode === "count") {
    out = "out count;";
  } else {
    const mode = args.out_mode || "center";
    const limit = args.limit || 50;
    out = `out ${mode} ${limit};`;
  }

  return `[out:json][timeout:${timeout}];\n${prefix}${body}\n${out}`;
}

// --- RESPONSE FORMATTING ----------------------------------------------------

function formatResult(data, notes = []) {
  let text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  if (text.length > MAX_RESPONSE_CHARS) {
    const omitted = text.length - MAX_RESPONSE_CHARS;
    text =
      text.slice(0, MAX_RESPONSE_CHARS) +
      `\n\n... [TRUNCATED: ${omitted} characters omitted. This is a PARTIAL result - ` +
      `narrow the bounding box, add tag filters, or lower the limit to see the whole answer.]`;
  }
  return notes.length ? `${notes.join("\n")}\n\n${text}` : text;
}

/**
 * Overpass returns HTTP 200 with a `remark` when a query hits its timeout or
 * memory ceiling, so partial data looks identical to complete data. Say so.
 */
function overpassNotes(data, query) {
  const notes = [];
  if (data && data.remark) {
    notes.push(
      `WARNING - Overpass returned a remark, so these results are INCOMPLETE: ${data.remark}`
    );
  }
  if (data && Array.isArray(data.elements) && data.elements.length === 0) {
    notes.push("No elements matched. Check the tag keys/values with the taginfo_* tools, or widen the area.");
  }
  if (query) notes.push(`Query executed:\n${query}`);
  return notes;
}

// --- TOOL DEFINITIONS -------------------------------------------------------
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [

      // ── OVERPASS API ────────────────────────────────────────────────────────
      {
        name: "find_features",
        description:
          "PRIMARY TOOL for finding OSM features by tag within an area. Builds and runs an Overpass query. " +
          "Scope it with bbox, or lat+lon+radius_m, or area_name, or area_osm_id (one is required). " +
          "(Docs: https://wiki.openstreetmap.org/wiki/Overpass_API)",
        inputSchema: {
          type: "object",
          properties: {
            tags: {
              type: "object",
              description:
                'Tag filters as key/value pairs, e.g. {"amenity":"hospital"}. Value syntax: "*" = key exists, ' +
                '"~regex" = regex match, "!~regex" = regex non-match, "!value" = not equal, otherwise exact match.',
              additionalProperties: { type: "string" },
            },
            raw_filter: { type: "string", description: 'Extra raw Overpass filter appended verbatim, e.g. ["name"~"clinic",i]' },
            bbox: { type: "string", description: 'Bounding box "south,west,north,east" in decimal degrees' },
            lat: { type: "number", description: "Centre latitude for a radius search" },
            lon: { type: "number", description: "Centre longitude for a radius search" },
            radius_m: { type: "number", description: "Radius in metres for a lat/lon search (default 1000)" },
            area_name: { type: "string", description: 'Search inside a named OSM area, e.g. "Nairobi". Exact name match.' },
            area_osm_id: { type: "integer", description: "Search inside an OSM relation/way id (from geocode_search). More reliable than area_name." },
            area_osm_type: { type: "string", enum: ["relation", "way"], description: "Type of area_osm_id (default relation)" },
            element_types: {
              type: "array",
              items: { type: "string", enum: ["node", "way", "relation"] },
              description: "Which primitive types to return (default all three)",
            },
            out_mode: {
              type: "string",
              enum: ["center", "body", "geom", "ids", "tags", "meta"],
              description: "Overpass output verbosity. 'center' (default) gives tags plus one representative coordinate.",
            },
            limit: { type: "integer", description: "Max elements to return (default 50)", default: 50 },
            timeout: { type: "integer", description: "Overpass server-side timeout in seconds (default 60)" },
          },
          required: ["tags"],
        },
      },
      {
        name: "count_features",
        description:
          "Count matching OSM features without returning them. Same filters as find_features. " +
          "Use this first to size a query before pulling data.",
        inputSchema: {
          type: "object",
          properties: {
            tags: { type: "object", description: "Tag filters, same syntax as find_features", additionalProperties: { type: "string" } },
            raw_filter: { type: "string", description: "Extra raw Overpass filter appended verbatim" },
            bbox: { type: "string", description: 'Bounding box "south,west,north,east"' },
            lat: { type: "number", description: "Centre latitude for a radius search" },
            lon: { type: "number", description: "Centre longitude for a radius search" },
            radius_m: { type: "number", description: "Radius in metres (default 1000)" },
            area_name: { type: "string", description: "Search inside a named OSM area" },
            area_osm_id: { type: "integer", description: "Search inside an OSM relation/way id" },
            area_osm_type: { type: "string", enum: ["relation", "way"], description: "Type of area_osm_id (default relation)" },
            element_types: { type: "array", items: { type: "string", enum: ["node", "way", "relation"] }, description: "Primitive types to count" },
            timeout: { type: "integer", description: "Overpass timeout in seconds (default 60)" },
          },
          required: ["tags"],
        },
      },
      {
        name: "overpass_query",
        description:
          "Run a raw Overpass QL query. Full control for anything find_features cannot express (unions, recursion, " +
          "diffs, polygon clipping). Start the query with [out:json] to get JSON back. " +
          "(Docs: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL)",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Complete Overpass QL query, including its own [out:json][timeout:N]; header and out statement" },
          },
          required: ["query"],
        },
      },
      {
        name: "xapi_query",
        description:
          "Run a legacy XAPI predicate against Overpass's XAPI Compatibility Layer, for porting old XAPI code. " +
          "XAPI itself was retired and replaced by Overpass — prefer find_features for new work. " +
          'Example predicate: node[amenity=cafe][bbox=-0.11,51.50,-0.10,51.51] ' +
          "Returns OSM XML, and always uses the first configured Overpass endpoint (mirrors may not enable " +
          "this layer). (Docs: https://wiki.openstreetmap.org/wiki/Overpass_API/XAPI_Compatibility_Layer)",
        inputSchema: {
          type: "object",
          properties: {
            predicate: {
              type: "string",
              description: 'XAPI path expression, e.g. node[amenity=cafe][bbox=left,bottom,right,top]',
            },
          },
          required: ["predicate"],
        },
      },
      {
        name: "overpass_status",
        description:
          "Check the Overpass server's rate limit and how many query slots are free. Run this when queries " +
          "start failing with 429 or 504. (Docs: /api/status)",
        inputSchema: { type: "object", properties: {} },
      },

      // ── MAIN API v0.6 ───────────────────────────────────────────────────────
      {
        name: "get_api_versions",
        description:
          "List the API versions this instance supports. The documented first step before reading a specific " +
          "version's capabilities. (Docs: /api/versions)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_api_capabilities",
        description:
          "Get the live Main API limits and status (max bbox area, node/member caps, timeouts, database status). " +
          "(Docs: /api/0.6/capabilities)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_permissions",
        description:
          "List the permissions granted to the current API connection. Returns an empty list when unauthenticated; " +
          "with OSM_ACCESS_TOKEN set, returns the granted OAuth 2.0 scopes (prefixed 'allow_'). " +
          "(Docs: /api/0.6/permissions)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_map_data",
        description:
          "Download every element inside a small bounding box from the live editing database. " +
          "Hard-limited to 0.25 square degrees - use find_features for anything larger or tag-filtered. " +
          "(Docs: /api/0.6/map)",
        inputSchema: {
          type: "object",
          properties: {
            bbox: { type: "string", description: 'Bounding box "south,west,north,east" - area must be under 0.25 sq deg' },
          },
          required: ["bbox"],
        },
      },
      {
        name: "get_element",
        description:
          "Get a single node, way or relation by id, optionally at a specific version. " +
          "(Docs: /api/0.6/{type}/{id})",
        inputSchema: {
          type: "object",
          properties: {
            element_type: { type: "string", enum: ["node", "way", "relation"], description: "Element type" },
            element_id: { type: "integer", description: "Element id" },
            version: { type: "integer", description: "Optional version number for a historic revision" },
          },
          required: ["element_type", "element_id"],
        },
      },
      {
        name: "get_element_full",
        description:
          "Get a way or relation together with all elements it references (its nodes, and for relations its members). " +
          "(Docs: /api/0.6/{type}/{id}/full)",
        inputSchema: {
          type: "object",
          properties: {
            element_type: { type: "string", enum: ["way", "relation"], description: "Element type (nodes have no /full)" },
            element_id: { type: "integer", description: "Element id" },
          },
          required: ["element_type", "element_id"],
        },
      },
      {
        name: "get_elements",
        description:
          "Fetch many elements of one type in a single call. (Docs: /api/0.6/{type}s?{type}s=id1,id2)",
        inputSchema: {
          type: "object",
          properties: {
            element_type: { type: "string", enum: ["node", "way", "relation"], description: "Element type" },
            element_ids: { type: "array", items: { type: "integer" }, description: "List of element ids" },
          },
          required: ["element_type", "element_ids"],
        },
      },
      {
        name: "get_element_history",
        description:
          "Get every version of an element, showing how it changed over time. (Docs: /api/0.6/{type}/{id}/history)",
        inputSchema: {
          type: "object",
          properties: {
            element_type: { type: "string", enum: ["node", "way", "relation"], description: "Element type" },
            element_id: { type: "integer", description: "Element id" },
          },
          required: ["element_type", "element_id"],
        },
      },
      {
        name: "get_element_relations",
        description:
          "List the relations that an element belongs to. (Docs: /api/0.6/{type}/{id}/relations)",
        inputSchema: {
          type: "object",
          properties: {
            element_type: { type: "string", enum: ["node", "way", "relation"], description: "Element type" },
            element_id: { type: "integer", description: "Element id" },
          },
          required: ["element_type", "element_id"],
        },
      },
      {
        name: "get_node_ways",
        description:
          "List the ways that use a given node. (Docs: /api/0.6/node/{id}/ways)",
        inputSchema: {
          type: "object",
          properties: {
            node_id: { type: "integer", description: "Node id" },
          },
          required: ["node_id"],
        },
      },
      {
        name: "list_changesets",
        description:
          "List changesets, filtered by area, user, time or open/closed state. Max 100 per call. " +
          "(Docs: /api/0.6/changesets)",
        inputSchema: {
          type: "object",
          properties: {
            bbox: { type: "string", description: 'Bounding box "south,west,north,east" (note: OSM expects min_lon,min_lat,max_lon,max_lat - this tool reorders for you)' },
            user: { type: "integer", description: "Filter by numeric user id" },
            display_name: { type: "string", description: "Filter by username" },
            time_from: { type: "string", description: "Closed after this time (ISO 8601, e.g. 2026-01-01T00:00:00Z)" },
            time_to: { type: "string", description: "Created before this time (ISO 8601). Requires time_from." },
            open: { type: "boolean", description: "Only currently open changesets" },
            closed: { type: "boolean", description: "Only closed changesets" },
            changeset_ids: { type: "array", items: { type: "integer" }, description: "Fetch specific changeset ids" },
            limit: { type: "integer", description: "Max results, 1-100 (default 100)", default: 100 },
          },
        },
      },
      {
        name: "get_changeset",
        description:
          "Get a single changeset's metadata and tags, optionally with its discussion comments. " +
          "(Docs: /api/0.6/changeset/{id})",
        inputSchema: {
          type: "object",
          properties: {
            changeset_id: { type: "integer", description: "Changeset id" },
            include_discussion: { type: "boolean", description: "Include the comment thread" },
          },
          required: ["changeset_id"],
        },
      },
      {
        name: "get_changeset_download",
        description:
          "Download the actual edits in a changeset as OsmChange XML (created/modified/deleted elements). " +
          "(Docs: /api/0.6/changeset/{id}/download)",
        inputSchema: {
          type: "object",
          properties: {
            changeset_id: { type: "integer", description: "Changeset id" },
          },
          required: ["changeset_id"],
        },
      },
      {
        name: "search_changeset_comments",
        description:
          "Search changeset discussion comments by author or date range. With no filters, returns the most recent " +
          "comments globally. (Docs: /api/0.6/changeset_comments)",
        inputSchema: {
          type: "object",
          properties: {
            display_name: { type: "string", description: "Comments written by this username (takes priority over user)" },
            user: { type: "integer", description: "Comments written by this numeric user id" },
            from: { type: "string", description: "Start of date range (ISO 8601, e.g. 2026-01-01)" },
            to: { type: "string", description: "End of date range (ISO 8601). Only works with from." },
          },
        },
      },
      {
        name: "get_user",
        description: "Get a mapper's public profile by numeric user id. (Docs: /api/0.6/user/{id})",
        inputSchema: {
          type: "object",
          properties: {
            user_id: { type: "integer", description: "Numeric OSM user id" },
          },
          required: ["user_id"],
        },
      },
      {
        name: "get_users",
        description: "Get several mapper profiles at once. (Docs: /api/0.6/users?users=id1,id2)",
        inputSchema: {
          type: "object",
          properties: {
            user_ids: { type: "array", items: { type: "integer" }, description: "Numeric OSM user ids" },
          },
          required: ["user_ids"],
        },
      },
      {
        name: "list_notes",
        description:
          "List map notes (user-reported issues) inside a bounding box. Area limit is 25 square degrees. " +
          "(Docs: /api/0.6/notes)",
        inputSchema: {
          type: "object",
          properties: {
            bbox: { type: "string", description: 'Bounding box "south,west,north,east" - area must be under 25 sq deg' },
            limit: { type: "integer", description: "Max notes, 1-10000 (default 100)", default: 100 },
            closed: { type: "integer", description: "Days a note can have been closed and still appear. 0 = open only, -1 = all." },
          },
          required: ["bbox"],
        },
      },
      {
        name: "search_notes",
        description:
          "Full-text search across map notes, optionally filtered by author, date or area. " +
          "(Docs: /api/0.6/notes/search)",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Free-text search term" },
            bbox: { type: "string", description: 'Optional bounding box "south,west,north,east"' },
            display_name: { type: "string", description: "Filter by note author username" },
            user: { type: "integer", description: "Filter by note author numeric id" },
            from: { type: "string", description: "Created after this date (YYYY-MM-DD)" },
            to: { type: "string", description: "Created before this date (YYYY-MM-DD)" },
            closed: { type: "integer", description: "Days closed and still shown. 0 = open only, -1 = all." },
            limit: { type: "integer", description: "Max notes (default 100)", default: 100 },
          },
        },
      },
      {
        name: "get_note",
        description: "Get a single map note and its full comment thread. (Docs: /api/0.6/notes/{id})",
        inputSchema: {
          type: "object",
          properties: {
            note_id: { type: "integer", description: "Note id" },
          },
          required: ["note_id"],
        },
      },
      {
        name: "get_notes_feed",
        description:
          "Get an RSS feed of map notes in an area — useful for monitoring new reports. Returns XML. " +
          "(Docs: /api/0.6/notes/feed)",
        inputSchema: {
          type: "object",
          properties: {
            bbox: { type: "string", description: 'Optional bounding box "south,west,north,east", max 25 sq deg' },
          },
        },
      },
      {
        name: "get_user_block",
        description:
          "Read a user block record by id — why a mapper was blocked, by whom, and for how long. " +
          "(Docs: /api/0.6/user_blocks/{id})",
        inputSchema: {
          type: "object",
          properties: {
            block_id: { type: "integer", description: "User block id" },
          },
          required: ["block_id"],
        },
      },

      // ── GPS TRACES ──────────────────────────────────────────────────────────
      {
        name: "get_trackpoints",
        description:
          "Get public GPS trace points inside a bounding box, as GPX XML. Paged at 5000 points. " +
          "(Docs: /api/0.6/trackpoints)",
        inputSchema: {
          type: "object",
          properties: {
            bbox: { type: "string", description: 'Bounding box "south,west,north,east"' },
            page: { type: "integer", description: "Page number, 0-based (default 0)", default: 0 },
          },
          required: ["bbox"],
        },
      },
      {
        name: "get_gpx_metadata",
        description:
          "Get metadata about one uploaded GPS trace (name, description, tags, visibility, owner). " +
          "Requires OSM_ACCESS_TOKEN — in practice the live API rejects anonymous requests here even for " +
          "public traces. (Docs: /api/0.6/gpx/{id})",
        inputSchema: {
          type: "object",
          properties: {
            gpx_id: { type: "integer", description: "GPS trace id" },
          },
          required: ["gpx_id"],
        },
      },
      {
        name: "get_gpx_data",
        description:
          "Download the full GPS trace file. Requires OSM_ACCESS_TOKEN. (Docs: /api/0.6/gpx/{id}/data)",
        inputSchema: {
          type: "object",
          properties: {
            gpx_id: { type: "integer", description: "GPS trace id" },
            format: { type: "string", enum: ["gpx", "xml", "original"], description: "Response format (default gpx)" },
          },
          required: ["gpx_id"],
        },
      },

      // ── AUTHENTICATED ACCOUNT ENDPOINTS (need OSM_ACCESS_TOKEN) ─────────────
      {
        name: "get_my_details",
        description:
          "Get the authenticated user's own profile — id, display name, home location, roles, changeset and " +
          "trace counts, unread messages. Requires OSM_ACCESS_TOKEN (scope read_prefs). " +
          "(Docs: /api/0.6/user/details)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_my_preferences",
        description:
          "Get the authenticated user's stored editor preferences as key/value pairs. Requires OSM_ACCESS_TOKEN " +
          "(scope read_prefs). (Docs: /api/0.6/user/preferences)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "list_my_gpx_files",
        description:
          "List the GPS traces owned by the authenticated user. Requires OSM_ACCESS_TOKEN (scope read_gpx). " +
          "(Docs: /api/0.6/user/gpx_files)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "list_my_active_blocks",
        description:
          "Check whether the authenticated user is currently blocked. Works even while blocked, unlike most " +
          "authenticated endpoints. Requires OSM_ACCESS_TOKEN. (Docs: /api/0.6/user/blocks/active)",
        inputSchema: { type: "object", properties: {} },
      },

      // ── NOMINATIM (SEARCH / GEOCODING) ──────────────────────────────────────
      {
        name: "geocode_search",
        description:
          "Turn a place name or address into coordinates and an OSM id. Run this first to get an area_osm_id " +
          "for find_features, or a bbox for the Main API tools. (Docs: https://nominatim.org/release-docs/latest/api/Search/)",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Free-form query, e.g. 'Kibera, Nairobi'" },
            street: { type: "string", description: "Structured query: street with house number" },
            city: { type: "string", description: "Structured query: city" },
            county: { type: "string", description: "Structured query: county" },
            state: { type: "string", description: "Structured query: state" },
            country: { type: "string", description: "Structured query: country" },
            postalcode: { type: "string", description: "Structured query: postal code" },
            countrycodes: { type: "string", description: "Restrict to comma-separated ISO 3166-1 alpha-2 codes, e.g. 'ke,tz'" },
            viewbox: { type: "string", description: "Preferred area as 'lon1,lat1,lon2,lat2'" },
            bounded: { type: "boolean", description: "Restrict results strictly to viewbox" },
            layer: { type: "string", description: "Comma-separated: address, poi, railway, natural, manmade" },
            addressdetails: { type: "boolean", description: "Include a broken-down address", default: true },
            extratags: { type: "boolean", description: "Include extra OSM tags" },
            polygon_geojson: { type: "boolean", description: "Include the boundary geometry as GeoJSON (large)" },
            limit: { type: "integer", description: "Max results, 1-40 (default 10)", default: 10 },
          },
        },
      },
      {
        name: "reverse_geocode",
        description:
          "Turn coordinates into the nearest address / named place. " +
          "(Docs: https://nominatim.org/release-docs/latest/api/Reverse/)",
        inputSchema: {
          type: "object",
          properties: {
            lat: { type: "number", description: "Latitude" },
            lon: { type: "number", description: "Longitude" },
            zoom: { type: "integer", description: "Detail level 0-18: 3=country, 10=city, 18=building (default 18)" },
            addressdetails: { type: "boolean", description: "Include a broken-down address", default: true },
            extratags: { type: "boolean", description: "Include extra OSM tags" },
            layer: { type: "string", description: "Comma-separated: address, poi, railway, natural, manmade" },
          },
          required: ["lat", "lon"],
        },
      },
      {
        name: "lookup_osm_ids",
        description:
          "Get address details for known OSM objects. Ids are prefixed N/W/R, e.g. 'R1278890,N240109189'. " +
          "(Docs: https://nominatim.org/release-docs/latest/api/Lookup/)",
        inputSchema: {
          type: "object",
          properties: {
            osm_ids: { type: "string", description: "Comma-separated prefixed ids, max 50, e.g. 'R1278890,W12345'" },
            addressdetails: { type: "boolean", description: "Include a broken-down address", default: true },
            extratags: { type: "boolean", description: "Include extra OSM tags" },
          },
          required: ["osm_ids"],
        },
      },
      {
        name: "get_nominatim_status",
        description: "Check the geocoding service's health and how fresh its data is. (Docs: /status)",
        inputSchema: { type: "object", properties: {} },
      },

      // ── TAGINFO (TAG DISCOVERY) ─────────────────────────────────────────────
      {
        name: "taginfo_search_keys",
        description:
          "Find real OSM tag keys by substring, ranked by how often they are used. Use this before writing a " +
          "find_features query so the tags actually exist. (Docs: https://taginfo.openstreetmap.org/taginfo/apidoc)",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Substring to match against key names, e.g. 'health'" },
            limit: { type: "integer", description: "Max keys to return (default 20)", default: 20 },
            page: { type: "integer", description: "Page number, 1-based (default 1)", default: 1 },
          },
          required: ["query"],
        },
      },
      {
        name: "taginfo_key_values",
        description:
          "List the values actually used with a given OSM key, most common first, with usage counts. " +
          "(Docs: /api/4/key/values)",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string", description: "Tag key, e.g. 'amenity'" },
            query: { type: "string", description: "Optional substring filter on the values" },
            limit: { type: "integer", description: "Max values to return (default 25)", default: 25 },
            page: { type: "integer", description: "Page number, 1-based (default 1)", default: 1 },
          },
          required: ["key"],
        },
      },
      {
        name: "taginfo_tag_stats",
        description:
          "Get global usage statistics for one key or one key=value tag, broken down by element type. " +
          "(Docs: /api/4/tag/stats, /api/4/key/stats)",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string", description: "Tag key" },
            value: { type: "string", description: "Optional tag value. Omit for key-level stats." },
          },
          required: ["key"],
        },
      },

      // ── BULK DATA SOURCES ───────────────────────────────────────────────────
      {
        name: "list_bulk_download_sources",
        description:
          "List the bulk OSM download sources (Planet.osm, Geofabrik extracts, slice.openstreetmap.us, " +
          "Open Planet Data) with their URLs, formats and update frequency. Returns links only - these files " +
          "are gigabytes and are meant for offline import, not for fetching through this server.",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  };
});

const BULK_SOURCES = {
  note:
    "These are bulk downloads for offline import into a local database. They are far too large to fetch " +
    "through an MCP tool - use find_features (Overpass) for live queries instead.",
  sources: [
    {
      name: "Planet.osm",
      url: "https://planet.openstreetmap.org/",
      formats: ["OSM XML (.osm.bz2)", "PBF (.osm.pbf)"],
      coverage: "Whole world",
      updated: "Weekly, with minutely/hourly/daily changesets for keeping a copy current",
      notes: "The canonical full dump; tens of GB as PBF. Minutely/hourly/daily diffs keep a local copy current.",
    },
    {
      name: "Geofabrik extracts",
      url: "https://download.geofabrik.de/",
      formats: ["PBF", "OSM XML", "Shapefile"],
      coverage: "Continents, countries, and sub-regions such as states",
      updated: "Daily",
      notes: "The usual starting point when you only need one country or region.",
    },
    {
      name: "slice.openstreetmap.us",
      url: "https://slice.openstreetmap.us",
      formats: ["PBF"],
      coverage: "Arbitrary bounding polygon you supply",
      updated: "On demand",
      notes: "Provides a time-limited link to re-download the same cut.",
    },
    {
      name: "Open Planet Data",
      url: "https://openplanetdata.com",
      formats: ["PBF", "GeoDesk GOL", "GeoParquet"],
      coverage: "Worldwide; arbitrary regions via 'gol load'",
      updated: "Daily",
      notes: "GeoParquet output suits analytical workflows (DuckDB, Spark).",
    },
  ],
  database_schemas: {
    note: "For loading the above into a database, pick a schema by use case:",
    osm2pgsql: "Rendering and general analysis; updatable; PostGIS geometries; lossy",
    apidb: "Mirroring the main API; updatable; no geometries; lossless",
    pgsnapshot: "Analysis; updatable; optional geometries; lossless; hstore tags",
    imposm: "Rendering; not updatable; PostGIS geometries; configurable mapping",
    nominatim: "Search and geocoding; updatable; PostGIS geometries; lossless",
    overpass: "Ad-hoc analysis queries; updatable; custom store",
    oshdb: "Historical / time-series analysis; not updatable",
  },
};

// --- TOOL HANDLERS ----------------------------------------------------------
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    let result;
    let notes = [];

    switch (name) {

      // OVERPASS
      case "find_features": {
        const query = buildOverpassQuery(args, "data");
        result = await callOverpass(query);
        notes = overpassNotes(result, query);
        break;
      }
      case "count_features": {
        const query = buildOverpassQuery(args, "count");
        result = await callOverpass(query);
        notes = overpassNotes(result, query);
        break;
      }
      case "overpass_query": {
        if (!args.query) throw new Error("query is required.");
        result = await callOverpass(args.query);
        notes = overpassNotes(result, null);
        if (typeof result === "string") {
          notes.push("Response is not JSON - add [out:json] to the query header to get structured output.");
        }
        break;
      }
      case "overpass_status":
        result = await callOverpassStatus();
        notes.push(`Endpoint: ${OVERPASS_URL}`);
        break;
      case "xapi_query":
        if (!args.predicate) throw new Error("predicate is required.");
        result = await callXapi(args.predicate);
        notes.push(
          "Format is OSM XML. XAPI is a legacy compatibility layer - use find_features for new work."
        );
        break;

      // MAIN API - CAPABILITIES AND MAP DATA
      case "get_api_versions":
        result = await callOsmApi("/api/versions.json");
        break;
      case "get_api_capabilities":
        // The unversioned /api/capabilities is deprecated in favour of the versioned path.
        result = await callOsmApi("/api/0.6/capabilities.json");
        break;
      case "get_permissions":
        result = await callOsmApi("/api/0.6/permissions.json");
        if (!OSM_ACCESS_TOKEN) {
          notes.push("No OSM_ACCESS_TOKEN is set, so this connection is anonymous and the permission list is empty.");
        }
        break;
      case "get_map_data": {
        const b = parseBbox(args.bbox);
        if (b.area > MAX_MAP_AREA_SQ_DEG) {
          throw new Error(
            `Bounding box is ${b.area.toFixed(4)} sq deg, over the Main API limit of ${MAX_MAP_AREA_SQ_DEG}. ` +
            `Shrink the box, or use find_features (Overpass), which has no such limit and lets you filter by tag.`
          );
        }
        // The /map endpoint takes bbox as min_lon,min_lat,max_lon,max_lat.
        result = await callOsmApi("/api/0.6/map.json", {
          bbox: `${b.west},${b.south},${b.east},${b.north}`,
        });
        break;
      }

      // MAIN API - ELEMENTS
      case "get_element": {
        const base = `/api/0.6/${args.element_type}/${args.element_id}`;
        result = await callOsmApi(args.version ? `${base}/${args.version}.json` : `${base}.json`);
        break;
      }
      case "get_element_full":
        result = await callOsmApi(`/api/0.6/${args.element_type}/${args.element_id}/full.json`);
        break;
      case "get_elements": {
        if (!Array.isArray(args.element_ids) || !args.element_ids.length) {
          throw new Error("element_ids must be a non-empty array.");
        }
        const plural = `${args.element_type}s`;
        result = await callOsmApi(`/api/0.6/${plural}.json`, { [plural]: args.element_ids.join(",") });
        break;
      }
      case "get_element_history":
        result = await callOsmApi(`/api/0.6/${args.element_type}/${args.element_id}/history.json`);
        break;
      case "get_element_relations":
        result = await callOsmApi(`/api/0.6/${args.element_type}/${args.element_id}/relations.json`);
        break;
      case "get_node_ways":
        result = await callOsmApi(`/api/0.6/node/${args.node_id}/ways.json`);
        break;

      // MAIN API - CHANGESETS
      case "list_changesets": {
        const params = {
          user: args.user,
          display_name: args.display_name,
          open: args.open,
          closed: args.closed,
          limit: Math.min(args.limit || 100, 100),
        };
        if (args.bbox) {
          const b = parseBbox(args.bbox);
          params.bbox = `${b.west},${b.south},${b.east},${b.north}`;
        }
        if (args.time_from) {
          params.time = args.time_to ? `${args.time_from},${args.time_to}` : args.time_from;
        }
        if (Array.isArray(args.changeset_ids) && args.changeset_ids.length) {
          params.changesets = args.changeset_ids.join(",");
        }
        result = await callOsmApi("/api/0.6/changesets.json", params);
        break;
      }
      case "get_changeset":
        result = await callOsmApi(`/api/0.6/changeset/${args.changeset_id}.json`, {
          include_discussion: args.include_discussion ? "true" : undefined,
        });
        break;
      case "get_changeset_download":
        // OsmChange is XML-only; there is no .json variant.
        result = await callOsmApi(`/api/0.6/changeset/${args.changeset_id}/download`);
        notes.push("Format is OsmChange XML - the Main API does not offer JSON for this endpoint.");
        break;

      case "search_changeset_comments":
        result = await callOsmApi("/api/0.6/changeset_comments.json", {
          display_name: args.display_name,
          user: args.user,
          from: args.from,
          to: args.to,
        });
        break;

      // MAIN API - USERS
      case "get_user":
        result = await callOsmApi(`/api/0.6/user/${args.user_id}.json`);
        break;
      case "get_users": {
        if (!Array.isArray(args.user_ids) || !args.user_ids.length) {
          throw new Error("user_ids must be a non-empty array.");
        }
        result = await callOsmApi("/api/0.6/users.json", { users: args.user_ids.join(",") });
        break;
      }

      // MAIN API - NOTES
      case "list_notes": {
        const b = parseBbox(args.bbox);
        if (b.area > MAX_NOTE_AREA_SQ_DEG) {
          throw new Error(
            `Bounding box is ${b.area.toFixed(2)} sq deg, over the notes limit of ${MAX_NOTE_AREA_SQ_DEG}. Shrink the box.`
          );
        }
        result = await callOsmApi("/api/0.6/notes.json", {
          bbox: `${b.west},${b.south},${b.east},${b.north}`,
          limit: Math.min(args.limit || 100, 10000),
          closed: args.closed,
        });
        break;
      }
      case "search_notes": {
        const params = {
          q: args.q,
          display_name: args.display_name,
          user: args.user,
          from: args.from,
          to: args.to,
          closed: args.closed,
          limit: Math.min(args.limit || 100, 10000),
        };
        if (args.bbox) {
          const b = parseBbox(args.bbox);
          params.bbox = `${b.west},${b.south},${b.east},${b.north}`;
        }
        result = await callOsmApi("/api/0.6/notes/search.json", params);
        break;
      }
      case "get_note":
        result = await callOsmApi(`/api/0.6/notes/${args.note_id}.json`);
        break;

      case "get_notes_feed": {
        const params = {};
        if (args.bbox) {
          const b = parseBbox(args.bbox);
          if (b.area > MAX_NOTE_AREA_SQ_DEG) {
            throw new Error(
              `Bounding box is ${b.area.toFixed(2)} sq deg, over the notes limit of ${MAX_NOTE_AREA_SQ_DEG}. Shrink the box.`
            );
          }
          params.bbox = `${b.west},${b.south},${b.east},${b.north}`;
        }
        result = await callOsmApi("/api/0.6/notes/feed", params);
        notes.push("Format is RSS XML - this endpoint has no JSON variant.");
        break;
      }
      case "get_user_block":
        result = await callOsmApi(`/api/0.6/user_blocks/${args.block_id}.json`);
        break;

      // MAIN API - GPS TRACES
      case "get_trackpoints": {
        const b = parseBbox(args.bbox);
        result = await callOsmApi("/api/0.6/trackpoints", {
          bbox: `${b.west},${b.south},${b.east},${b.north}`,
          page: args.page || 0,
        });
        notes.push("Format is GPX XML - this endpoint has no JSON variant.");
        break;
      }
      case "get_gpx_metadata":
        result = await callOsmApi(`/api/0.6/gpx/${args.gpx_id}.json`, {}, {
          requiresAuth: true,
          scope: "read_gpx",
        });
        break;
      case "get_gpx_data": {
        const suffix = args.format === "xml" ? ".xml" : args.format === "original" ? "" : ".gpx";
        result = await callOsmApi(`/api/0.6/gpx/${args.gpx_id}/data${suffix}`, {}, {
          requiresAuth: true,
          scope: "read_gpx",
        });
        break;
      }

      // MAIN API - AUTHENTICATED ACCOUNT ENDPOINTS
      case "get_my_details":
        result = await callOsmApi("/api/0.6/user/details.json", {}, {
          requiresAuth: true,
          scope: "read_prefs",
        });
        break;
      case "get_my_preferences":
        result = await callOsmApi("/api/0.6/user/preferences.json", {}, {
          requiresAuth: true,
          scope: "read_prefs",
        });
        break;
      case "list_my_gpx_files":
        result = await callOsmApi("/api/0.6/user/gpx_files.json", {}, {
          requiresAuth: true,
          scope: "read_gpx",
        });
        break;
      case "list_my_active_blocks":
        result = await callOsmApi("/api/0.6/user/blocks/active.json", {}, {
          requiresAuth: true,
        });
        break;

      // NOMINATIM
      case "geocode_search":
        if (!args.q && !args.street && !args.city && !args.country && !args.postalcode && !args.state && !args.county) {
          throw new Error("Provide q, or at least one structured field (street/city/county/state/country/postalcode).");
        }
        result = await callNominatim("/search", {
          q: args.q,
          street: args.street,
          city: args.city,
          county: args.county,
          state: args.state,
          country: args.country,
          postalcode: args.postalcode,
          countrycodes: args.countrycodes,
          viewbox: args.viewbox,
          bounded: args.bounded ? 1 : undefined,
          layer: args.layer,
          addressdetails: args.addressdetails === false ? 0 : 1,
          extratags: args.extratags ? 1 : undefined,
          polygon_geojson: args.polygon_geojson ? 1 : undefined,
          limit: Math.min(args.limit || 10, 40),
        });
        notes.push(
          "To search inside one of these places with find_features, pass its osm_id as area_osm_id " +
          "(and area_osm_type matching its osm_type)."
        );
        break;
      case "reverse_geocode":
        result = await callNominatim("/reverse", {
          lat: args.lat,
          lon: args.lon,
          zoom: args.zoom,
          addressdetails: args.addressdetails === false ? 0 : 1,
          extratags: args.extratags ? 1 : undefined,
          layer: args.layer,
        });
        break;
      case "lookup_osm_ids":
        result = await callNominatim("/lookup", {
          osm_ids: args.osm_ids,
          addressdetails: args.addressdetails === false ? 0 : 1,
          extratags: args.extratags ? 1 : undefined,
        });
        break;
      case "get_nominatim_status":
        result = await callNominatim("/status", { format: "json" });
        break;

      // TAGINFO
      case "taginfo_search_keys":
        result = await callTaginfo("/api/4/keys/all", {
          query: args.query,
          page: args.page || 1,
          rp: Math.min(args.limit || 20, 100),
          sortname: "count_all",
          sortorder: "desc",
        });
        break;
      case "taginfo_key_values":
        result = await callTaginfo("/api/4/key/values", {
          key: args.key,
          query: args.query,
          page: args.page || 1,
          rp: Math.min(args.limit || 25, 100),
          sortname: "count_all",
          sortorder: "desc",
        });
        break;
      case "taginfo_tag_stats":
        result = args.value
          ? await callTaginfo("/api/4/tag/stats", { key: args.key, value: args.value })
          : await callTaginfo("/api/4/key/stats", { key: args.key });
        break;

      // BULK SOURCES
      case "list_bulk_download_sources":
        result = BULK_SOURCES;
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return { content: [{ type: "text", text: formatResult(result, notes) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
});

// --- START ---
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`OSM MCP Server v1.0.0 running on stdio (no API key required, UA: ${USER_AGENT})`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
