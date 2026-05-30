/**
 * IFRC GO API Local MCP Server (Secure Version)
 * 
 * REQUIREMENTS:
 * 1. Create a .env file in the same folder containing: IFRC_API_TOKEN=your_token
 * 2. Run 'node server.js'
 */

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. Load environment variables from .env file
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

// Check for dependencies and auto-install
const requiredPackages = ["@modelcontextprotocol/sdk", "axios", "dotenv"];
// Note: We don't need 'dotenv' package if we parse manually like above, 
// but we include it in logic just in case users want to use the package later.
// For now, we use the manual parsing above to keep it dependency-free.

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

// Import packages
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const axios = require("axios");

// --- SERVER SETUP ---
const server = new Server(
  { name: "ifrc-go-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Helper: Authenticated API Call
async function callIfrcApi(endpoint, params = {}) {
  if (!IFRC_API_TOKEN || IFRC_API_TOKEN === "") {
    throw new Error("ERROR: API Token not found. Please check your .env file.");
  }

  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params,
      headers: {
        Authorization: `Bearer ${IFRC_API_TOKEN}`,
        Accept: "application/json",
      },
      timeout: 10000,
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
      {
        name: "search_ifrc",
        description: "Search IFRC GO globally. (Docs: /api/v1/search/)",
        inputSchema: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "Search term (required)" },
          },
          required: ["keyword"],
        },
      },
      {
        name: "search_appeals",
        description: "Search IFRC appeals. (Docs: /api/v2/appeal/)",
        inputSchema: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "Search term (required)" },
            limit: { type: "integer", description: "Max results", default: 10 },
          },
          required: ["keyword"],
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
        description: "Get comprehensive stats (population, GDP, climate). (Docs: /api/v2/country/{id}/databank/)",
        inputSchema: {
          type: "object",
          properties: {
            country_id: { type: "integer", description: "Country ID" },
          },
          required: ["country_id"],
        },
      },
      {
        name: "list_active_drefs",
        description: "List active Disaster Response Funds (DREF). (Docs: /api/v2/active-dref/)",
        inputSchema: {
          type: "object",
          properties: {
            country_id: { type: "integer", description: "Filter by country ID (optional)" },
            limit: { type: "integer", description: "Max results", default: 10 },
          },
        },
      },
      {
        name: "list_disasters_history",
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
    ],
  };
});

// --- TOOL EXECUTION ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;

    if (name === "search_ifrc") {
      result = await callIfrcApi("/api/v1/search/", { keyword: args.keyword });
    } else if (name === "search_appeals") {
      result = await callIfrcApi("/api/v2/appeal/", {
        search: args.keyword,
        limit: args.limit || 10,
      });
    } else if (name === "get_country_profile") {
      result = await callIfrcApi(`/api/v2/country/${args.country_id}/`);
    } else if (name === "get_country_databank") {
      result = await callIfrcApi(`/api/v2/country/${args.country_id}/databank/`);
    } else if (name === "list_active_drefs") {
      const params = { limit: args.limit || 10 };
      if (args.country_id) params.country = args.country_id;
      result = await callIfrcApi("/api/v2/active-dref/", params);
    } else if (name === "list_disasters_history") {
      const params = {};
      if (args.start_date) params.start_date_from = args.start_date;
      if (args.end_date) params.start_date_to = args.end_date;
      result = await callIfrcApi(`/api/v2/country/${args.country_id}/historical-disaster/`, params);
    } else {
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
  console.error("IFRC MCP Server running on stdio (Token loaded from .env)");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
