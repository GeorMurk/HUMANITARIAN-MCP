const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
require("dotenv").config({ path: path.resolve(__dirname, ".env"), quiet: true });

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const axios = require("axios");

const API_BASE = (process.env.MONTY_API_URL || "https://montandon-eoapi-stage.ifrc.org/stac").replace(/\/$/, "");
const API_TOKEN = process.env.IFRC_API_TOKEN || process.env.MONTY_API_TOKEN;

if (!API_TOKEN) {
  console.error("FATAL: Missing IFRC_API_TOKEN or MONTY_API_TOKEN in .env.");
  process.exit(1);
}

const server = new Server(
  { name: "monty-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

async function callMonty(endpoint, options = {}) {
  try {
    const response = await axios({
      method: options.method || "GET",
      url: `${API_BASE}${endpoint}`,
      params: options.params,
      data: options.data,
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_stac_root",
        description: "Get the Monty STAC API root document.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_collections",
        description: "List Monty STAC collections.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Maximum collections to return." },
          },
        },
      },
      {
        name: "get_collection",
        description: "Get details for a Monty STAC collection.",
        inputSchema: {
          type: "object",
          properties: {
            collection_id: { type: "string", description: "Collection ID." },
          },
          required: ["collection_id"],
        },
      },
      {
        name: "search_items",
        description: "Search Monty STAC items.",
        inputSchema: {
          type: "object",
          properties: {
            collections: {
              type: "array",
              items: { type: "string" },
              description: "Optional collection IDs to search.",
            },
            bbox: {
              type: "array",
              items: { type: "number" },
              minItems: 4,
              maxItems: 6,
              description: "Optional bounding box: [west, south, east, north].",
            },
            datetime: {
              type: "string",
              description: "Optional STAC datetime or interval, such as 2024-01-01/2024-12-31.",
            },
            limit: { type: "integer", description: "Maximum items to return.", default: 10 },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result;

    if (name === "get_stac_root") {
      result = await callMonty("");
    } else if (name === "list_collections") {
      result = await callMonty("/collections", {
        params: args.limit ? { limit: args.limit } : undefined,
      });
    } else if (name === "get_collection") {
      result = await callMonty(`/collections/${encodeURIComponent(args.collection_id)}`);
    } else if (name === "search_items") {
      const body = { limit: args.limit || 10 };
      if (args.collections) body.collections = args.collections;
      if (args.bbox) body.bbox = args.bbox;
      if (args.datetime) body.datetime = args.datetime;
      result = await callMonty("/search", { method: "POST", data: body });
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Monty MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
