#!/usr/bin/env bash
# Build a Docker image for every humanitarian MCP server.
# Each image is tagged mcp-humanitarian/<name>:latest and is used by the
# Docker MCP gateway (see ~/.docker/mcp/catalogs/humanitarian.yaml).
#
# Servers are discovered from the *-mcp directories present in this folder, so
# the script picks up any server you have locally without needing a hardcoded
# list. Image name = directory minus the -mcp suffix; the entrypoint is
# server.js, or index.js for servers that use that instead.
set -euo pipefail
cd "$(dirname "$0")"

shopt -s nullglob
count=0

for dir in *-mcp; do
  name="${dir%-mcp}"

  if [ -f "${dir}/server.js" ]; then
    file="server.js"
  elif [ -f "${dir}/index.js" ]; then
    file="index.js"
  else
    echo ">>> Skipping ${dir}: no server.js or index.js entrypoint" >&2
    continue
  fi

  echo ">>> Building mcp-humanitarian/${name}:latest from ${dir} (entry: ${file})"
  docker build -q -t "mcp-humanitarian/${name}:latest" \
    -f Dockerfile --build-arg "ENTRY=${file}" "${dir}"
  count=$((count + 1))
done

echo "Done. Built ${count} images:"
docker images "mcp-humanitarian/*"
