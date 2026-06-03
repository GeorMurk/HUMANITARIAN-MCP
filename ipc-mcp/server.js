/**
 * IPC-CH Public API MCP Server
 *
 * REQUIREMENTS:
 * 1. Create a .env file in the same folder containing: IPC_API_KEY=your_key
 * 2. Run 'node server.js'
 *
 * API docs: https://docs.api.ipcinfo.org/
 * Extended docs: https://observablehq.com/@ipc/ipc-api-extended-documentation
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

const IPC_API_KEY = process.env.IPC_API_KEY;
const BASE_URL = "https://api.ipcinfo.org";

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
  { name: "ipc-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

async function callIpcApi(endpoint, params = {}, requiresKey = true) {
  if (requiresKey && (!IPC_API_KEY || IPC_API_KEY === "")) {
    throw new Error("ERROR: API Key not found. Please check your .env file (IPC_API_KEY=your_key).");
  }
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
  );
  if (requiresKey && IPC_API_KEY) {
    cleanParams.key = IPC_API_KEY;
  }
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: cleanParams,
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

// --- TOOL DEFINITIONS ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [

      // ── SYSTEM ───────────────────────────────────────────────────────────────
      {
        name: "health_check",
        description: "Check the health status of the IPC API. No API key required. (Docs: GET /health)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },

      // ── PUBLIC ENDPOINTS ─────────────────────────────────────────────────────
      {
        name: "list_analyses",
        description: "List all available IPC analyses with basic metadata. Returns simplified data with only the most recent period per analysis. (Docs: GET /analyses)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "string", description: "Two-letter ISO country code filter (e.g. 'AF', 'KE', 'SO')", minLength: 2, maxLength: 2 },
            year: { type: "integer", description: "Year filter (2015–2030)", minimum: 2015, maximum: 2030 },
            type: { type: "string", enum: ["A", "C"], description: "Analysis type: A=Acute Food Insecurity, C=Chronic Food Insecurity" },
            format: { type: "string", enum: ["json", "csv", "geojson"], description: "Response format (default: json)", default: "json" },
          },
        },
      },
      {
        name: "get_country_population",
        description: "Get country-level IPC population data for the latest analysis in a given year. Returns the currently valid analysis period (or most recent if all are past). (Docs: GET /country)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "string", description: "Two-letter ISO country code (e.g. 'AF', 'KE', 'SO')", minLength: 2, maxLength: 2 },
            year: { type: "integer", description: "Year filter (2015–2030)", minimum: 2015, maximum: 2030 },
            type: { type: "string", enum: ["A", "C"], description: "Analysis type: A=Acute Food Insecurity, C=Chronic Food Insecurity" },
            format: { type: "string", enum: ["json", "csv", "geojson"], description: "Response format (default: json)", default: "json" },
          },
        },
      },
      {
        name: "get_areas",
        description: "Get IPC population data at area (sub-national) level for all analyses. Returns simplified data with the most recent valid period. (Docs: GET /areas)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "string", description: "Two-letter ISO country code filter (e.g. 'AF', 'KE', 'SO')", minLength: 2, maxLength: 2 },
            year: { type: "integer", description: "Year filter (2015–2030)", minimum: 2015, maximum: 2030 },
            type: { type: "string", enum: ["A", "C"], description: "Analysis type: A=Acute Food Insecurity, C=Chronic Food Insecurity" },
            format: { type: "string", enum: ["json", "csv", "geojson"], description: "Response format (default: json)", default: "json" },
          },
        },
      },
      {
        name: "get_points",
        description: "Get IDP (Internally Displaced Persons) and urban area point data for all analyses. (Docs: GET /points)",
        inputSchema: {
          type: "object",
          properties: {
            year: { type: "integer", description: "Year filter (2015–2030)", minimum: 2015, maximum: 2030 },
            type: { type: "string", enum: ["A", "C"], description: "Analysis type: A=Acute Food Insecurity, C=Chronic Food Insecurity" },
          },
        },
      },
      {
        name: "get_icons",
        description: "Get IPC bag and warning icons data for all analyses. Icons represent phase-level classifications. (Docs: GET /icons)",
        inputSchema: {
          type: "object",
          properties: {
            year: { type: "integer", description: "Year filter (2015–2030)", minimum: 2015, maximum: 2030 },
            type: { type: "string", enum: ["A", "C"], description: "Analysis type: A=Acute Food Insecurity, C=Chronic Food Insecurity" },
          },
        },
      },

      // ── DEVELOPER ENDPOINTS ──────────────────────────────────────────────────
      {
        name: "get_analysis",
        description: "Get detailed information for a specific IPC analysis by its ID, including all validity periods and metadata. (Docs: GET /analysis/{id})",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Analysis ID (obtainable from list_analyses)" },
          },
          required: ["id"],
        },
      },
      {
        name: "get_areas_by_analysis",
        description: "Get all sub-national area data for a specific analysis ID and period. Returns full area-level IPC phase and population data. Period: C=Current, P=Projection, A=Second Projection. (Docs: GET /areas/{id}/{period})",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Analysis ID" },
            period: { type: "string", enum: ["C", "P", "A"], description: "Analysis period: C=Current, P=Projection, A=Second Projection" },
            format: { type: "string", enum: ["json", "csv", "geojson"], description: "Response format (default: json)", default: "json" },
          },
          required: ["id", "period"],
        },
      },
      {
        name: "get_population_tracking",
        description: "Get population tracking (PT) data across multiple analyses. WARNING: Without filters this returns very large datasets — always use country or year filters. (Docs: GET /population)",
        inputSchema: {
          type: "object",
          properties: {
            country: { type: "string", description: "Two-letter ISO country code filter (e.g. 'AF', 'KE', 'SO')", minLength: 2, maxLength: 2 },
            start: { type: "integer", description: "Start year (defaults to current year)", minimum: 2015, maximum: 2030 },
            end: { type: "integer", description: "End year (defaults to current year)", minimum: 2015, maximum: 2030 },
          },
        },
      },
      {
        name: "get_population_by_analysis",
        description: "Get detailed population tracking data for a single specific analysis by ID. (Docs: GET /population/{id})",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Analysis ID" },
          },
          required: ["id"],
        },
      },
      {
        name: "get_points_by_analysis",
        description: "Get detailed IDP and urban area point data for a single analysis and period, including full population figures. Period: C=Current, P=Projection, A=Second Projection. (Docs: GET /points/{id}/{period})",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Analysis ID" },
            period: { type: "string", enum: ["C", "P", "A"], description: "Analysis period: C=Current, P=Projection, A=Second Projection" },
          },
          required: ["id", "period"],
        },
      },
      {
        name: "get_icons_by_analysis",
        description: "Get bag and warning icons for a single analysis and period. (Docs: GET /icons/{id}/{period})",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Analysis ID" },
            period: { type: "string", enum: ["C", "P", "A"], description: "Analysis period: C=Current, P=Projection, A=Second Projection" },
          },
          required: ["id", "period"],
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

      // SYSTEM
      case "health_check":
        result = await callIpcApi("/health", {}, false);
        break;

      // PUBLIC
      case "list_analyses":
        result = await callIpcApi("/analyses", {
          country: args.country,
          year: args.year,
          type: args.type,
          format: args.format,
        });
        break;
      case "get_country_population":
        result = await callIpcApi("/country", {
          country: args.country,
          year: args.year,
          type: args.type,
          format: args.format,
        });
        break;
      case "get_areas":
        result = await callIpcApi("/areas", {
          country: args.country,
          year: args.year,
          type: args.type,
          format: args.format,
        });
        break;
      case "get_points":
        result = await callIpcApi("/points", {
          year: args.year,
          type: args.type,
        });
        break;
      case "get_icons":
        result = await callIpcApi("/icons", {
          year: args.year,
          type: args.type,
        });
        break;

      // DEVELOPER
      case "get_analysis":
        result = await callIpcApi(`/analysis/${args.id}`);
        break;
      case "get_areas_by_analysis":
        result = await callIpcApi(`/areas/${args.id}/${args.period}`, {
          format: args.format,
        });
        break;
      case "get_population_tracking":
        result = await callIpcApi("/population", {
          country: args.country,
          start: args.start,
          end: args.end,
        });
        break;
      case "get_population_by_analysis":
        result = await callIpcApi(`/population/${args.id}`);
        break;
      case "get_points_by_analysis":
        result = await callIpcApi(`/points/${args.id}/${args.period}`);
        break;
      case "get_icons_by_analysis":
        result = await callIpcApi(`/icons/${args.id}/${args.period}`);
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
  if (!IPC_API_KEY) {
    console.error("WARNING: IPC_API_KEY not set in .env file. Protected endpoints will fail.");
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("IPC-CH MCP Server v1.0.0 running on stdio");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
