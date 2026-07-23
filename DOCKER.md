# Running the humanitarian MCPs in Docker

All 15 humanitarian MCP servers in this repo run as Docker containers, served
through the **Docker MCP gateway** (Docker Desktop's MCP Toolkit). Claude Desktop
talks to a single gateway process; the gateway launches each MCP as an ephemeral
container on demand. **If Docker Desktop is not running, the gateway cannot start
and none of these MCPs are available** — that is by design.

## Components

| Piece | Location |
|-------|----------|
| Per-MCP image build | `Dockerfile` + `build-mcps.sh` (this repo) |
| Images | `mcp-humanitarian/<name>:latest` (local Docker) |
| Gateway catalog (image + secret wiring) | `~/.docker/mcp/catalogs/humanitarian.yaml` |
| Enabled-server list | `~/.docker/mcp/humanitarian-registry.yaml` |
| Secrets | Docker Desktop OS keychain (`docker mcp secret`) |
| Claude Desktop wiring | `MCP_DOCKER` entry in `claude_desktop_config.json` |

The `MCP_DOCKER` server runs:

```
docker mcp gateway run \
  --additional-catalog humanitarian.yaml \
  --registry humanitarian-registry.yaml
```

`--additional-catalog` adds our 13 servers on top of the official Docker MCP
catalog (which still provides `github-official` and `postman`). `--registry`
lists exactly which servers are enabled. This replaces the previous per-server
`node .../server.js` entries. Note: this deliberately avoids `--profile`, which
is mutually exclusive with `--catalog`/`--registry`; GitHub OAuth and the Postman
API key still resolve from the same Docker Desktop keychain.

### Tool-name prefixes (avoiding collisions)

Some servers expose tools with the same name — e.g. `fewsnet` and `hdx` both
have `get_currencies` (both wrap the HDX HAPI). The gateway refuses to start if
two enabled servers share a tool name. To prevent this, every humanitarian
server has a `prefix:` in `humanitarian.yaml`, so its tools are namespaced
(`fewsnet__get_currencies`, `hdx__get_currencies`, `ifrc__get_appeal`, …).
`github-official` and `postman` have **no** prefix, so their tool names are
unchanged. (The global `docker mcp feature enable tool-name-prefix` is an
alternative, but it would prefix GitHub/Postman tools too, so we use per-server
prefixes instead.) If you add a new server that collides, give it a `prefix:`.

## Rebuilding the images

```bash
./build-mcps.sh
```

Each image is built from its own MCP directory (with vendored `node_modules`, so
the build is offline). Secrets are **never** baked into images.

> The gateway runs these images with `--pull never` and they exist only locally
> (no registry to pull from). A `docker system prune -a` will delete them — just
> re-run `./build-mcps.sh` to rebuild.

## Managing secrets

Secrets live in the Docker Desktop keychain, sourced originally from `.env`.
Secret name == environment variable name. To (re)load them all from `.env`:

```bash
for name in IFRC_API_TOKEN HDX_API_TOKEN IPC_API_KEY FEWSNET_USERNAME \
  FEWSNET_PASSWORD RELIEFWEB_APPNAME HOTOSM_ACCESS_TOKEN KOBO_API_TOKEN \
  ACAPS_USERNAME ACAPS_PASSWORD ACLED_USERNAME ACLED_PASSWORD; do
  docker mcp secret rm "$name" 2>/dev/null
  val=$(grep -m1 "^${name}=" .env); val=${val#${name}=}
  printf '%s' "$val" | docker mcp secret set "$name"
done
```

(`monty` reuses `IFRC_API_TOKEN`; `unhcr-refugees` and `unhcr-resettlement` need
no secrets.)

## Verifying the whole setup

Introspect every server without starting the gateway for real:

```bash
docker mcp gateway run --additional-catalog humanitarian.yaml \
  --registry humanitarian-registry.yaml --dry-run --verbose
```

You should see all 17 servers enabled (github-official, postman + the 15) each
reporting a tool count, and no `Secret '...' not found` warnings.

## Reverting to the old profile-based setup

A backup of the original was saved before the change:

- Config: `claude_desktop_config.json.bak.<timestamp>` (same folder)
- Gateway profile: `~/claude_connections.export.backup.yaml`

Restore the config `.bak` and change `MCP_DOCKER` args back to
`["mcp","gateway","run","--profile","claude_connections"]`.
