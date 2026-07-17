/**
 * World Bank Data Catalog (DDH OpenAPI) MCP Server
 *
 * Wraps the World Bank Development Data Hub catalog API:
 *   https://ddh-openapi.worldbank.org/docs/index.html
 *
 * This is a public, unauthenticated API — no API token is required.
 *
 * REQUIREMENTS:
 * 1. Run 'node server.js' (dependencies auto-install on first run)
 * 2. (Optional) A .env file may set WORLDBANK_API_BASE to override the base URL.
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

const BASE_URL = process.env.WORLDBANK_API_BASE || "https://ddh-openapi.worldbank.org";

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
  { name: "worldbank-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

async function callWorldBankApi(endpoint, params = {}) {
  // Remove undefined/null params
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
  );
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: cleanParams,
      headers: {
        Accept: "application/json",
      },
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
        name: "search_catalog",
        description: "Query the published World Bank Data Catalog for datasets or resources. (Docs: GET /search)",
        inputSchema: {
          type: "object",
          properties: {
            qname: { type: "string", description: "Type of query: 'dataset' or 'resource'", enum: ["dataset", "resource"] },
            param: { type: "string", description: "Free-text search term / query parameter" },
            filter: { type: "string", description: "Search filter expression (OData-style filter)" },
            top: { type: "integer", description: "Max results to return (default 50)", default: 50 },
            skip: { type: "integer", description: "Results to skip for pagination (default 0)" },
          },
        },
      },

      // ── DATASETS ────────────────────────────────────────────────────────────
      {
        name: "list_datasets",
        description: "List all datasets in the catalog. (Docs: GET /datasets)",
        inputSchema: {
          type: "object",
          properties: {
            top: { type: "integer", description: "Max results to return (default 100)", default: 100 },
            skip: { type: "integer", description: "Results to skip for pagination (default 0)" },
          },
        },
      },
      {
        name: "get_dataset",
        description: "View metadata for a specific dataset. (Docs: GET /datasets/{dataset_unique_id})",
        inputSchema: {
          type: "object",
          properties: {
            dataset_unique_id: { type: "string", description: "Unique id of the dataset to fetch" },
            version: { type: "string", description: "Dataset version (optional)" },
          },
          required: ["dataset_unique_id"],
        },
      },
      {
        name: "get_dataset_history",
        description: "View a dataset's version history. (Docs: GET /datasets/{dataset_unique_id}/history)",
        inputSchema: {
          type: "object",
          properties: {
            dataset_unique_id: { type: "string", description: "Dataset unique id" },
            version: { type: "string", description: "Blob version id (required)" },
          },
          required: ["dataset_unique_id", "version"],
        },
      },
      {
        name: "list_recent_datasets",
        description: "View recently published (new or updated) datasets. (Docs: GET /datasets/recent)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "download_dataset",
        description: "Get the download URL/info for a dataset. (Docs: GET /dataset/download)",
        inputSchema: {
          type: "object",
          properties: {
            dataset_unique_id: { type: "string", description: "Dataset id" },
            version: { type: "string", description: "Version to download (optional)" },
          },
          required: ["dataset_unique_id"],
        },
      },

      // ── INDICATORS ──────────────────────────────────────────────────────────
      {
        name: "list_indicators",
        description: "View the list of all indicators for a dataset. (Docs: GET /indicators)",
        inputSchema: {
          type: "object",
          properties: {
            dataset_unique_id: { type: "string", description: "Dataset unique id" },
            top: { type: "integer", description: "Max results to return (default 100)", default: 100 },
            skip: { type: "integer", description: "Results to skip for pagination (default 0)" },
            version: { type: "string", description: "Dataset version (optional)" },
          },
          required: ["dataset_unique_id"],
        },
      },
      {
        name: "get_indicator",
        description: "View metadata for a specific indicator (latest dataset version). (Docs: GET /indicators/{indicator_unique_id})",
        inputSchema: {
          type: "object",
          properties: {
            indicator_unique_id: { type: "string", description: "Indicator unique id" },
            version: { type: "string", description: "Dataset version (optional)" },
          },
          required: ["indicator_unique_id"],
        },
      },

      // ── RESOURCES ───────────────────────────────────────────────────────────
      {
        name: "list_resources",
        description: "View all resources (files) for a specified dataset. (Docs: GET /resources)",
        inputSchema: {
          type: "object",
          properties: {
            dataset_unique_id: { type: "string", description: "Dataset unique id" },
            top: { type: "integer", description: "Max results to return (default 100)", default: 100 },
            skip: { type: "integer", description: "Results to skip for pagination (default 0)" },
            version: { type: "string", description: "Dataset version (optional)" },
          },
          required: ["dataset_unique_id"],
        },
      },
      {
        name: "get_resource",
        description: "View metadata for a specific resource. (Docs: GET /resources/{resource_unique_id})",
        inputSchema: {
          type: "object",
          properties: {
            resource_unique_id: { type: "string", description: "Resource unique id" },
            version: { type: "string", description: "Dataset version (optional)" },
          },
          required: ["resource_unique_id"],
        },
      },
      {
        name: "get_resource_metadata",
        description: "Retrieve the metadata for data within a resource file. (Docs: GET /resources/{resource_unique_id}/metadata)",
        inputSchema: {
          type: "object",
          properties: {
            resource_unique_id: { type: "string", description: "Resource unique id" },
            version: { type: "string", description: "Dataset version (optional)" },
          },
          required: ["resource_unique_id"],
        },
      },
      {
        name: "get_resource_data",
        description: "Retrieve the tabular data from a resource file, with optional filtering/column selection. (Docs: GET /resources/{resource_unique_id}/data)",
        inputSchema: {
          type: "object",
          properties: {
            resource_unique_id: { type: "string", description: "Resource unique id" },
            version: { type: "string", description: "Dataset version id (optional)" },
            top: { type: "integer", description: "Max rows to return (default 100)", default: 100 },
            skip: { type: "integer", description: "Rows to skip for pagination (default 0)" },
            filter: { type: "string", description: "Query filter to select a subset of resource rows" },
            select: { type: "string", description: "Comma-separated list of column names to return" },
          },
          required: ["resource_unique_id"],
        },
      },
      {
        name: "download_resource",
        description: "Get the download URL/info for a resource file. (Docs: GET /resources/{resource_unique_id}/download)",
        inputSchema: {
          type: "object",
          properties: {
            resource_unique_id: { type: "string", description: "Resource unique id" },
            version: { type: "string", description: "Dataset version (optional)" },
          },
          required: ["resource_unique_id"],
        },
      },
      {
        name: "list_resource_folder",
        description: "List all resources inside a resource folder. (Docs: GET /resources/{resource_unique_id}/list)",
        inputSchema: {
          type: "object",
          properties: {
            resource_unique_id: { type: "string", description: "Resource folder name/id" },
            version: { type: "string", description: "Dataset version (required)" },
          },
          required: ["resource_unique_id", "version"],
        },
      },

      // ── COLLECTIONS ─────────────────────────────────────────────────────────
      {
        name: "list_collections",
        description: "List all collections. (Docs: GET /collections)",
        inputSchema: {
          type: "object",
          properties: {
            top: { type: "integer", description: "Max results to return (default 100)", default: 100 },
            skip: { type: "integer", description: "Results to skip for pagination (default 0)" },
          },
        },
      },
      {
        name: "get_collection",
        description: "View a specific collection by id. (Docs: GET /collections/{collection_id})",
        inputSchema: {
          type: "object",
          properties: {
            collection_id: { type: "string", description: "Collection id" },
          },
          required: ["collection_id"],
        },
      },

      // ── CITATIONS ───────────────────────────────────────────────────────────
      {
        name: "list_citations",
        description: "View dataset citations. (Docs: GET /citations)",
        inputSchema: {
          type: "object",
          properties: {
            dataset_unique_id: { type: "string", description: "Unique id of the dataset containing the citations" },
            top: { type: "integer", description: "Max results to return (default 100)", default: 100 },
            skip: { type: "integer", description: "Results to skip for pagination (default 0)" },
            version: { type: "string", description: "Dataset version (optional)" },
          },
          required: ["dataset_unique_id"],
        },
      },
      {
        name: "get_citation",
        description: "View the latest version of a specific citation by id. (Docs: GET /citations/{citation_unique_id})",
        inputSchema: {
          type: "object",
          properties: {
            citation_unique_id: { type: "string", description: "Unique id of the citation to retrieve" },
            version: { type: "string", description: "Dataset version (optional)" },
          },
          required: ["citation_unique_id"],
        },
      },

      // ── CODELISTS (LOOKUPS) ─────────────────────────────────────────────────
      {
        name: "list_codelists",
        description: "View all lookup information (topics, licenses, formats, etc.). (Docs: GET /codelists)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_codelist",
        description: "View lookup information for a specific code list type. (Docs: GET /codelists/{code_list_type})",
        inputSchema: {
          type: "object",
          properties: {
            code_list_type: { type: "string", description: "Code list type (see keys returned by list_codelists)" },
          },
          required: ["code_list_type"],
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
      case "search_catalog":
        result = await callWorldBankApi("/search", {
          qname: args.qname,
          param: args.param,
          filter: args.filter,
          top: args.top || 50,
          skip: args.skip,
        });
        break;

      // DATASETS
      case "list_datasets":
        result = await callWorldBankApi("/datasets", {
          top: args.top || 100,
          skip: args.skip,
        });
        break;
      case "get_dataset":
        result = await callWorldBankApi(`/datasets/${encodeURIComponent(args.dataset_unique_id)}`, {
          version: args.version,
        });
        break;
      case "get_dataset_history":
        result = await callWorldBankApi(`/datasets/${encodeURIComponent(args.dataset_unique_id)}/history`, {
          version: args.version,
        });
        break;
      case "list_recent_datasets":
        result = await callWorldBankApi("/datasets/recent");
        break;
      case "download_dataset":
        result = await callWorldBankApi("/dataset/download", {
          dataset_unique_id: args.dataset_unique_id,
          version: args.version,
        });
        break;

      // INDICATORS
      case "list_indicators":
        result = await callWorldBankApi("/indicators", {
          dataset_unique_id: args.dataset_unique_id,
          top: args.top || 100,
          skip: args.skip,
          version: args.version,
        });
        break;
      case "get_indicator":
        result = await callWorldBankApi(`/indicators/${encodeURIComponent(args.indicator_unique_id)}`, {
          version: args.version,
        });
        break;

      // RESOURCES
      case "list_resources":
        result = await callWorldBankApi("/resources", {
          dataset_unique_id: args.dataset_unique_id,
          top: args.top || 100,
          skip: args.skip,
          version: args.version,
        });
        break;
      case "get_resource":
        result = await callWorldBankApi(`/resources/${encodeURIComponent(args.resource_unique_id)}`, {
          version: args.version,
        });
        break;
      case "get_resource_metadata":
        result = await callWorldBankApi(`/resources/${encodeURIComponent(args.resource_unique_id)}/metadata`, {
          version: args.version,
        });
        break;
      case "get_resource_data":
        result = await callWorldBankApi(`/resources/${encodeURIComponent(args.resource_unique_id)}/data`, {
          version: args.version,
          top: args.top || 100,
          skip: args.skip,
          filter: args.filter,
          select: args.select,
        });
        break;
      case "download_resource":
        result = await callWorldBankApi(`/resources/${encodeURIComponent(args.resource_unique_id)}/download`, {
          version: args.version,
        });
        break;
      case "list_resource_folder":
        result = await callWorldBankApi(`/resources/${encodeURIComponent(args.resource_unique_id)}/list`, {
          version: args.version,
        });
        break;

      // COLLECTIONS
      case "list_collections":
        result = await callWorldBankApi("/collections", {
          top: args.top || 100,
          skip: args.skip,
        });
        break;
      case "get_collection":
        result = await callWorldBankApi(`/collections/${encodeURIComponent(args.collection_id)}`);
        break;

      // CITATIONS
      case "list_citations":
        result = await callWorldBankApi("/citations", {
          dataset_unique_id: args.dataset_unique_id,
          top: args.top || 100,
          skip: args.skip,
          version: args.version,
        });
        break;
      case "get_citation":
        result = await callWorldBankApi(`/citations/${encodeURIComponent(args.citation_unique_id)}`, {
          version: args.version,
        });
        break;

      // CODELISTS
      case "list_codelists":
        result = await callWorldBankApi("/codelists");
        break;
      case "get_codelist":
        result = await callWorldBankApi(`/codelists/${encodeURIComponent(args.code_list_type)}`);
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
  console.error(`World Bank Data Catalog MCP Server v1.0.0 running on stdio (base: ${BASE_URL})`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
