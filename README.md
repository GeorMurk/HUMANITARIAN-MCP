# IFRC GO MCP Server

Local Model Context Protocol (MCP) server for querying the IFRC GO API from Claude Desktop or another MCP client.

The server runs over stdio, loads an IFRC API token from `.env`, and exposes tools for searching IFRC GO data, appeals, country profiles, databank stats, active DREFs, and historical disasters.

## Requirements

- Node.js
- npm
- IFRC GO API token

## Setup

Install dependencies:

```bash
cd /[YOUR PATH]/MCPs/ifrc-mcp
npm install
```

Create a `.env` file either in this folder or in the parent `MCPs` folder:

```bash
IFRC_API_TOKEN=your_token_here
```

The server sends the token as a Bearer token to:

```text
https://goadmin.ifrc.org
```

## Run Locally

Start with npm:

```bash
npm start
```

Or run directly with Node:

```bash
node server.js
```

When the server starts successfully, you should see:

```text
IFRC MCP Server running on stdio (Token loaded from .env)
```

## Claude Desktop Configuration

Add this server to your Claude Desktop config:

```json
{
  "mcpServers": {
    "ifrc-go": {
      "command": "node",
      "args": ["/[YOUR PATH]/MCPs/ifrc-mcp/server.js"]
    }
  }
}
```

After editing the config, restart Claude Desktop.

## Available Tools

### `search_ifrc`

Searches IFRC GO globally using `/api/v1/search/`.

Example:

```json
{
  "keyword": "Sudan appeals"
}
```

### `search_appeals`

Searches IFRC appeals using `/api/v2/appeal/`.

Example:

```json
{
  "keyword": "Sudan",
  "limit": 10
}
```

### `get_country_profile`

Gets detailed country information using `/api/v2/country/{id}/`.

Example:

```json
{
  "country_id": 187
}
```

### `get_country_databank`

Gets country statistics using `/api/v2/country/{id}/databank/`.

Example:

```json
{
  "country_id": 187
}
```

### `list_active_drefs`

Lists active DREF records using `/api/v2/active-dref/`.

Example:

```json
{
  "country_id": 187,
  "limit": 10
}
```

### `list_disasters_history`

Gets historical disasters for a country using `/api/v2/country/{id}/historical-disaster/`.

Example:

```json
{
  "country_id": 187,
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```

## Monty Integration

This repo also includes a Monty MCP server for querying the Montandon STAC API.

Install dependencies:

```bash
cd /[YOUR PATH]/MCPs/monty-mcp
npm install
```

Add the Monty API URL to the parent `.env` file:

```bash
MONTY_API_URL=https://montandon-eoapi-stage.ifrc.org/stac
```

The Monty server uses the same `IFRC_API_TOKEN` from `.env` and sends it as a Bearer token.

Run locally:

```bash
npm start
```

Claude Desktop configuration:

```json
{
  "mcpServers": {
    "Monty MCP": {
      "command": "node",
      "args": ["/[YOUR PATH]/MCPs/monty-mcp/index.js"]
    }
  }
}
```

Available Monty tools:

### `get_stac_root`

Gets the Monty STAC API root document.

### `list_collections`

Lists Monty STAC collections.

Example:

```json
{
  "limit": 10
}
```

### `get_collection`

Gets details for a Monty STAC collection.

Example:

```json
{
  "collection_id": "collection-id"
}
```

### `search_items`

Searches Monty STAC items.

Example:

```json
{
  "datetime": "2024-01-01/2024-12-31",
  "limit": 10
}
```

## Troubleshooting

If you get `FATAL: Cannot start server. Missing IFRC_API_TOKEN`, check that `.env` exists and contains `IFRC_API_TOKEN`.

If you get a 401 response, check that the token is valid for the current IFRC GO API and has not expired.

If you get a 404 response, confirm the server is using `https://goadmin.ifrc.org`, not the older `https://go-api.ifrc.org` host.
