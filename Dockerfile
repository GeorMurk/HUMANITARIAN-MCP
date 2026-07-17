# Shared Dockerfile for the humanitarian MCP servers.
#
# Build one image per MCP with that MCP's directory as the build context:
#   docker build -t mcp-humanitarian/ifrc:latest --build-arg ENTRY=server.js ifrc-mcp
#   docker build -t mcp-humanitarian/monty:latest --build-arg ENTRY=index.js  monty-mcp
#
# Secrets are NOT baked into the image — the Docker MCP gateway injects them at
# run time from the OS keychain (see the `secrets:` blocks in
# ~/.docker/mcp/catalogs/humanitarian.yaml). Use build-mcps.sh to build them all.
FROM node:22-alpine

WORKDIR /app

# The build context is a single MCP directory (includes its vendored
# node_modules, so the build is fully offline).
COPY . /app/

# Only install if node_modules wasn't vendored into the context.
RUN if [ ! -d node_modules ]; then \
      (npm ci --omit=dev 2>/dev/null || npm install --omit=dev); \
    fi

ARG ENTRY=server.js
ENV MCP_ENTRY=${ENTRY}

# stdio transport: keep stdin/stdout attached to the node process.
CMD ["sh", "-c", "exec node \"$MCP_ENTRY\""]
