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
  { name: "monty-mcp", version: "2.0.0" },
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

      // ── LANDING / CONFORMANCE ────────────────────────────────────────────────
      {
        name: "get_stac_root",
        description: "Get the Monty STAC API root/landing page document. (GET /)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_conformance",
        description: "List OGC API conformance classes supported by this server. (GET /conformance)",
        inputSchema: { type: "object", properties: {} },
      },

      // ── HEALTH ───────────────────────────────────────────────────────────────
      {
        name: "ping",
        description: "Liveliness probe — check if the API is up. (GET /_mgmt/ping)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_health",
        description: "Get full system health/status of the API. (GET /_mgmt/health)",
        inputSchema: { type: "object", properties: {} },
      },

      // ── COLLECTIONS ──────────────────────────────────────────────────────────
      {
        name: "list_collections",
        description: "List all available STAC collections. (GET /collections)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Maximum number of collections to return." },
          },
        },
      },
      {
        name: "get_collection",
        description: "Get details for a specific STAC collection. (GET /collections/{collection_id})",
        inputSchema: {
          type: "object",
          properties: {
            collection_id: { type: "string", description: "Collection ID." },
          },
          required: ["collection_id"],
        },
      },
      {
        name: "create_collection",
        description: "Create a new STAC collection (Transaction Extension). (POST /collections)",
        inputSchema: {
          type: "object",
          properties: {
            collection: {
              type: "object",
              description: "Full STAC Collection object (must include id, type, description, links, etc.).",
            },
          },
          required: ["collection"],
        },
      },
      {
        name: "update_collection",
        description: "Replace/update an existing STAC collection (Transaction Extension). (PUT /collections/{collection_id})",
        inputSchema: {
          type: "object",
          properties: {
            collection_id: { type: "string", description: "Collection ID to update." },
            collection: { type: "object", description: "Full updated STAC Collection object." },
          },
          required: ["collection_id", "collection"],
        },
      },
      {
        name: "patch_collection",
        description: "Partially update a STAC collection (Transaction Extension). (PATCH /collections/{collection_id})",
        inputSchema: {
          type: "object",
          properties: {
            collection_id: { type: "string", description: "Collection ID to patch." },
            patch: { type: "object", description: "Partial STAC Collection fields to update." },
          },
          required: ["collection_id", "patch"],
        },
      },
      {
        name: "delete_collection",
        description: "Delete a STAC collection (Transaction Extension). (DELETE /collections/{collection_id})",
        inputSchema: {
          type: "object",
          properties: {
            collection_id: { type: "string", description: "Collection ID to delete." },
          },
          required: ["collection_id"],
        },
      },

      // ── ITEMS ────────────────────────────────────────────────────────────────
      {
        name: "list_collection_items",
        description: "List items in a STAC collection with optional spatial/temporal filters. (GET /collections/{collection_id}/items)",
        inputSchema: {
          type: "object",
          properties: {
            collection_id: { type: "string", description: "Collection ID." },
            bbox: {
              type: "array",
              items: { type: "number" },
              minItems: 4,
              maxItems: 6,
              description: "Bounding box filter: [west, south, east, north].",
            },
            datetime: {
              type: "string",
              description: "Datetime or interval filter, e.g. '2024-01-01/2024-12-31' or '2024-06-01T00:00:00Z'.",
            },
            limit: { type: "integer", description: "Max items to return.", default: 10 },
            token: { type: "string", description: "Pagination token." },
          },
          required: ["collection_id"],
        },
      },
      {
        name: "get_collection_item",
        description: "Get a specific item from a STAC collection. (GET /collections/{collection_id}/items/{item_id})",
        inputSchema: {
          type: "object",
          properties: {
            collection_id: { type: "string", description: "Collection ID." },
            item_id: { type: "string", description: "Item ID." },
          },
          required: ["collection_id", "item_id"],
        },
      },
      {
        name: "create_item",
        description: "Add a new STAC item to a collection (Transaction Extension). (POST /collections/{collection_id}/items)",
        inputSchema: {
          type: "object",
          properties: {
            collection_id: { type: "string", description: "Collection ID." },
            item: { type: "object", description: "Full STAC Item GeoJSON Feature object." },
          },
          required: ["collection_id", "item"],
        },
      },
      {
        name: "update_item",
        description: "Replace/update a STAC item (Transaction Extension). (PUT /collections/{collection_id}/items/{item_id})",
        inputSchema: {
          type: "object",
          properties: {
            collection_id: { type: "string", description: "Collection ID." },
            item_id: { type: "string", description: "Item ID to update." },
            item: { type: "object", description: "Full updated STAC Item object." },
          },
          required: ["collection_id", "item_id", "item"],
        },
      },
      {
        name: "patch_item",
        description: "Partially update a STAC item (Transaction Extension). (PATCH /collections/{collection_id}/items/{item_id})",
        inputSchema: {
          type: "object",
          properties: {
            collection_id: { type: "string", description: "Collection ID." },
            item_id: { type: "string", description: "Item ID to patch." },
            patch: { type: "object", description: "Partial STAC Item fields to update." },
          },
          required: ["collection_id", "item_id", "patch"],
        },
      },
      {
        name: "delete_item",
        description: "Delete a STAC item from a collection (Transaction Extension). (DELETE /collections/{collection_id}/items/{item_id})",
        inputSchema: {
          type: "object",
          properties: {
            collection_id: { type: "string", description: "Collection ID." },
            item_id: { type: "string", description: "Item ID to delete." },
          },
          required: ["collection_id", "item_id"],
        },
      },
      {
        name: "bulk_create_items",
        description: "Add multiple STAC items to a collection in one request (Bulk Transaction Extension). (POST /collections/{collection_id}/bulk_items)",
        inputSchema: {
          type: "object",
          properties: {
            collection_id: { type: "string", description: "Collection ID." },
            items: {
              type: "object",
              description: "Bulk items payload. Shape: { items: { <item_id>: <STAC Item>, ... }, method: 'insert'|'upsert' }",
            },
          },
          required: ["collection_id", "items"],
        },
      },

      // ── SEARCH ───────────────────────────────────────────────────────────────
      {
        name: "search_items",
        description: "Search STAC items across collections using spatial, temporal, and property filters (POST /search).",
        inputSchema: {
          type: "object",
          properties: {
            collections: {
              type: "array",
              items: { type: "string" },
              description: "Collection IDs to search within.",
            },
            ids: {
              type: "array",
              items: { type: "string" },
              description: "Filter by specific item IDs.",
            },
            bbox: {
              type: "array",
              items: { type: "number" },
              minItems: 4,
              maxItems: 6,
              description: "Bounding box: [west, south, east, north].",
            },
            datetime: {
              type: "string",
              description: "Datetime or interval, e.g. '2024-01-01/2024-12-31'.",
            },
            intersects: {
              type: "object",
              description: "GeoJSON geometry to spatially intersect with.",
            },
            query: {
              type: "object",
              description: "Item property filters as key/operator/value pairs.",
            },
            sortby: {
              type: "array",
              items: { type: "object" },
              description: "Sort fields, e.g. [{ field: 'properties.datetime', direction: 'desc' }].",
            },
            fields: {
              type: "object",
              description: "Fields to include/exclude: { include: [...], exclude: [...] }.",
            },
            filter: {
              type: "object",
              description: "CQL2-JSON filter expression for advanced property filtering.",
            },
            "filter-lang": {
              type: "string",
              description: "Filter language: 'cql2-json' or 'cql2-text'.",
              default: "cql2-json",
            },
            limit: { type: "integer", description: "Max items to return.", default: 10 },
            token: { type: "string", description: "Pagination token for next/previous page." },
          },
        },
      },
      {
        name: "search_items_get",
        description: "Search STAC items using GET with query parameters (GET /search). Use for simple searches; prefer search_items for complex queries.",
        inputSchema: {
          type: "object",
          properties: {
            collections: { type: "string", description: "Comma-separated collection IDs." },
            ids: { type: "string", description: "Comma-separated item IDs." },
            bbox: { type: "string", description: "Bounding box as comma-separated string: west,south,east,north." },
            datetime: { type: "string", description: "Datetime or interval." },
            limit: { type: "integer", default: 10 },
            token: { type: "string", description: "Pagination token." },
          },
        },
      },

      // ── QUERYABLES ───────────────────────────────────────────────────────────
      {
        name: "get_queryables",
        description: "List all globally queryable/filterable item properties. (GET /queryables)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_collection_queryables",
        description: "List queryable/filterable properties for a specific collection. (GET /collections/{collection_id}/queryables)",
        inputSchema: {
          type: "object",
          properties: {
            collection_id: { type: "string", description: "Collection ID." },
          },
          required: ["collection_id"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result;

    switch (name) {

      // LANDING / CONFORMANCE
      case "get_stac_root":
        result = await callMonty("");
        break;
      case "get_conformance":
        result = await callMonty("/conformance");
        break;

      // HEALTH
      case "ping":
        result = await callMonty("/_mgmt/ping");
        break;
      case "get_health":
        result = await callMonty("/_mgmt/health");
        break;

      // COLLECTIONS
      case "list_collections":
        result = await callMonty("/collections", {
          params: args.limit ? { limit: args.limit } : undefined,
        });
        break;
      case "get_collection":
        result = await callMonty(`/collections/${encodeURIComponent(args.collection_id)}`);
        break;
      case "create_collection":
        result = await callMonty("/collections", { method: "POST", data: args.collection });
        break;
      case "update_collection":
        result = await callMonty(`/collections/${encodeURIComponent(args.collection_id)}`, {
          method: "PUT",
          data: args.collection,
        });
        break;
      case "patch_collection":
        result = await callMonty(`/collections/${encodeURIComponent(args.collection_id)}`, {
          method: "PATCH",
          data: args.patch,
        });
        break;
      case "delete_collection":
        result = await callMonty(`/collections/${encodeURIComponent(args.collection_id)}`, {
          method: "DELETE",
        });
        break;

      // ITEMS
      case "list_collection_items": {
        const params = { limit: args.limit || 10 };
        if (args.bbox) params.bbox = args.bbox.join(",");
        if (args.datetime) params.datetime = args.datetime;
        if (args.token) params.token = args.token;
        result = await callMonty(`/collections/${encodeURIComponent(args.collection_id)}/items`, { params });
        break;
      }
      case "get_collection_item":
        result = await callMonty(
          `/collections/${encodeURIComponent(args.collection_id)}/items/${encodeURIComponent(args.item_id)}`
        );
        break;
      case "create_item":
        result = await callMonty(`/collections/${encodeURIComponent(args.collection_id)}/items`, {
          method: "POST",
          data: args.item,
        });
        break;
      case "update_item":
        result = await callMonty(
          `/collections/${encodeURIComponent(args.collection_id)}/items/${encodeURIComponent(args.item_id)}`,
          { method: "PUT", data: args.item }
        );
        break;
      case "patch_item":
        result = await callMonty(
          `/collections/${encodeURIComponent(args.collection_id)}/items/${encodeURIComponent(args.item_id)}`,
          { method: "PATCH", data: args.patch }
        );
        break;
      case "delete_item":
        result = await callMonty(
          `/collections/${encodeURIComponent(args.collection_id)}/items/${encodeURIComponent(args.item_id)}`,
          { method: "DELETE" }
        );
        break;
      case "bulk_create_items":
        result = await callMonty(
          `/collections/${encodeURIComponent(args.collection_id)}/bulk_items`,
          { method: "POST", data: args.items }
        );
        break;

      // SEARCH
      case "search_items": {
        const body = { limit: args.limit || 10 };
        if (args.collections) body.collections = args.collections;
        if (args.ids) body.ids = args.ids;
        if (args.bbox) body.bbox = args.bbox;
        if (args.datetime) body.datetime = args.datetime;
        if (args.intersects) body.intersects = args.intersects;
        if (args.query) body.query = args.query;
        if (args.sortby) body.sortby = args.sortby;
        if (args.fields) body.fields = args.fields;
        if (args.filter) body.filter = args.filter;
        if (args["filter-lang"]) body["filter-lang"] = args["filter-lang"];
        if (args.token) body.token = args.token;
        result = await callMonty("/search", { method: "POST", data: body });
        break;
      }
      case "search_items_get": {
        const params = { limit: args.limit || 10 };
        if (args.collections) params.collections = args.collections;
        if (args.ids) params.ids = args.ids;
        if (args.bbox) params.bbox = args.bbox;
        if (args.datetime) params.datetime = args.datetime;
        if (args.token) params.token = args.token;
        result = await callMonty("/search", { params });
        break;
      }

      // QUERYABLES
      case "get_queryables":
        result = await callMonty("/queryables");
        break;
      case "get_collection_queryables":
        result = await callMonty(`/collections/${encodeURIComponent(args.collection_id)}/queryables`);
        break;

      default:
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
  console.error("Monty MCP Server v2.0.0 running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
