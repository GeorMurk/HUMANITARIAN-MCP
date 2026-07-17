#!/usr/bin/env bash
# Build a Docker image for every humanitarian MCP server.
# Each image is tagged mcp-humanitarian/<name>:latest and is used by the
# Docker MCP gateway (see ~/.docker/mcp/catalogs/humanitarian.yaml).
set -euo pipefail
cd "$(dirname "$0")"

# name:dir:entrypoint
SERVERS=(
  "ifrc:ifrc-mcp:server.js"
  "monty:monty-mcp:index.js"
  "hdx:hdx-mcp:server.js"
  "unhcr-refugees:unhcr-refugees-mcp:server.js"
  "unhcr-resettlement:unhcr-resettlement-mcp:server.js"
  "ipc:ipc-mcp:server.js"
  "fewsnet:fewsnet-mcp:server.js"
  "reliefweb:reliefweb-mcp:server.js"
  "springer:springer-mcp:server.js"
  "hotosm:hotosm-mcp:server.js"
  "kobo:kobo-mcp:server.js"
  "acaps:acaps-mcp:server.js"
  "worldbank:worldbank-mcp:server.js"
)

for entry in "${SERVERS[@]}"; do
  IFS=":" read -r name dir file <<< "$entry"
  echo ">>> Building mcp-humanitarian/${name}:latest from ${dir} (entry: ${file})"
  docker build -q -t "mcp-humanitarian/${name}:latest" \
    -f Dockerfile --build-arg "ENTRY=${file}" "${dir}"
done

echo "Done. Built ${#SERVERS[@]} images:"
docker images "mcp-humanitarian/*"
