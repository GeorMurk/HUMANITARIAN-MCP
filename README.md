# Humanitarian Data MCP Servers

<p align="center">
  <a href="https://www.ifrc.org"><img src="https://github.com/IFRCGo.png?size=120" alt="IFRC" height="80"/></a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://www.unhcr.org"><img src="https://github.com/unhcr-dataviz.png?size=120" alt="UNHCR" height="80"/></a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://data.humdata.org"><img src="https://github.com/OCHA-DAP.png?size=120" alt="HDX / OCHA" height="80"/></a>
</p>

This repository contains five **MCP servers** that let you query humanitarian data directly from Claude (or any other MCP-compatible AI assistant).

---

## What is MCP?

**Model Context Protocol (MCP)** is an open standard that lets AI assistants like Claude connect to external tools and APIs. Instead of copy-pasting data into a chat window, you install an MCP server once and Claude can call it automatically whenever it needs information — like a plugin system for AI.

---

## What's in this repo?

| Server | Folder | What it does |
|---|---|---|
| **IFRC GO MCP** | `ifrc-mcp/` | Query the IFRC Global Operations platform — appeals, emergencies, field reports, deployed personnel, country profiles, and more |
| **Monty MCP** | `monty-mcp/` | Query the Montandon STAC API — geospatial disaster event catalogs and datasets |
| **HDX HAPI MCP** | `hdx-mcp/` | Query the OCHA Humanitarian Data Exchange API — population, displacement, food security, conflict, funding, and climate data |
| **UNHCR Refugee Statistics MCP** | `unhcr-refugees-mcp/` | Query the UNHCR Population Statistics API — refugee and displaced population figures, asylum applications/decisions, durable solutions, and demographics |
| **UNHCR Resettlement Data MCP** | `unhcr-resettlement-data/` | Query the UNHCR Resettlement Statistics (RSQ) API — submissions, departures, and demographic breakdowns for resettlement programmes |

**IFRC** stands for the *International Federation of Red Cross and Red Crescent Societies*. Their **GO** (Global Operations) platform is a public database tracking humanitarian operations, disaster appeals, field reports, and response activities worldwide.

**Monty** (short for Montandon) is a geospatial data API built on the **STAC** standard (*SpatioTemporal Asset Catalog*) — a common format for cataloguing earth observation and disaster-related datasets.

**HDX HAPI** is the [Humanitarian Data Exchange](https://data.humdata.org) API run by OCHA (UN Office for the Coordination of Humanitarian Affairs). It provides structured, cross-country access to humanitarian indicators: displacement figures, food security phases, conflict events, funding coverage, population statistics, and more.

**UNHCR** is the *UN Refugee Agency*. Their **Population Statistics API** exposes the global refugee database — figures on refugees, asylum seekers, IDPs, stateless persons, and durable solutions going back decades. Their **Resettlement (RSQ) API** covers submissions and departures for formal resettlement programmes worldwide. Both APIs are fully public and require no authentication.

---

## Prerequisites

Before you start, make sure you have:

- **Node.js** v18 or later — download from [nodejs.org](https://nodejs.org)
- **npm** — comes bundled with Node.js
- **Claude Desktop** — the Mac/Windows app from [claude.ai](https://claude.ai)
- **An IFRC GO API token** — create a free account at [go.ifrc.org](https://go.ifrc.org) and generate a token from your profile settings
- **An HDX app identifier** — register your app at [hapi.humdata.org](https://hapi.humdata.org/docs#/Util/get_encoded_identifier_api_v1_encode_identifier_get) to get a free base64-encoded identifier

> **Note:** The two UNHCR servers require no API token — they use a fully public API.

---

## One-time Setup

### 1. Clone or download this repository

```bash
git clone <your-repo-url> MCPs
cd MCPs
```

### 2. Create a `.env` file

Create a file named `.env` in the root `MCPs/` folder (all servers will find it automatically):

```bash
# Required by IFRC GO and Monty servers
IFRC_API_TOKEN=your_ifrc_token_here

# Optional — only needed for Monty if you want a non-default URL
MONTY_API_URL=https://montandon-eoapi-stage.ifrc.org/stac

# Required by HDX HAPI server
HDX_API_TOKEN=your_base64_encoded_hdx_identifier_here
```

Replace the placeholder values with your actual tokens. The UNHCR servers need no entries in this file.

> **Tip:** You can also place the `.env` file inside an individual server folder (e.g., `hdx-mcp/`). Each server searches in multiple locations.

### 3. Install dependencies for each server

```bash
cd ifrc-mcp && npm install && cd ..
cd monty-mcp && npm install && cd ..
cd hdx-mcp && npm install && cd ..
cd unhcr-refugees-mcp && npm install && cd ..
cd unhcr-resettlement-data && npm install && cd ..
```

---

## Configure Claude Desktop

Find your Claude Desktop configuration file:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Open it (create it if it doesn't exist) and add the following entries under `mcpServers`. Replace `/YOUR/PATH/TO` with the actual path to this repository:

```json
{
  "mcpServers": {
    "ifrc-go": {
      "command": "node",
      "args": ["/YOUR/PATH/TO/MCPs/ifrc-mcp/server.js"]
    },
    "monty": {
      "command": "node",
      "args": ["/YOUR/PATH/TO/MCPs/monty-mcp/index.js"]
    },
    "hdx-hapi": {
      "command": "node",
      "args": ["/YOUR/PATH/TO/MCPs/hdx-mcp/server.js"]
    },
    "unhcr-refugees": {
      "command": "node",
      "args": ["/YOUR/PATH/TO/MCPs/unhcr-refugees-mcp/server.js"]
    },
    "unhcr-resettlement": {
      "command": "node",
      "args": ["/YOUR/PATH/TO/MCPs/unhcr-resettlement-data/server.js"]
    }
  }
}
```

After saving, **restart Claude Desktop**. You should see all five servers' tools available in the tools panel.

---

## IFRC GO MCP Server

### About

This server connects Claude to the [IFRC GO API](https://goadmin.ifrc.org) — a comprehensive database of humanitarian operations run by the Red Cross and Red Crescent network. You can ask Claude questions like:

- *"What emergency appeals are active in Sudan right now?"*
- *"Show me the disaster history for Kenya in 2023."*
- *"List all surge personnel currently deployed to Turkey."*
- *"What DREFs are active in the Asia Pacific region?"*

### Available Tools

The tools are grouped by topic below. Each tool corresponds to an endpoint on the IFRC GO API.

---

#### Search

| Tool | Description |
|---|---|
| `search_ifrc` | Global keyword search across all IFRC GO data |

---

#### Appeals

An **appeal** is a formal request for funding to respond to a disaster. Types include DREF (small/fast funding), Emergency Appeal, and International Appeal.

| Tool | Description |
|---|---|
| `list_appeals` | List/search appeals with filters (country, region, type, status, disaster type) |
| `get_appeal` | Get full details for a single appeal by its ID |
| `list_appeal_documents` | List documents (PDFs, reports) attached to an appeal |

---

#### Events & Emergencies

An **event** is a recorded disaster or emergency in the IFRC system.

| Tool | Description |
|---|---|
| `list_events` | List emergency events with filters (country, region, disaster type, date range) |
| `get_event` | Get full details for a single emergency event |
| `list_disaster_types` | List all disaster/hazard categories (earthquake, flood, etc.) |
| `list_go_historical` | List historical GO emergency records by country |

---

#### Field Reports

**Field reports** are early assessments submitted by National Societies when a disaster occurs.

| Tool | Description |
|---|---|
| `list_field_reports` | List field reports with filters (country, event, disaster type, date range) |
| `get_field_report` | Get full details for a single field report |

---

#### Countries & Regions

| Tool | Description |
|---|---|
| `list_countries` | List countries with optional filters (name, ISO code, region) |
| `get_country_profile` | Get detailed information about a specific country |
| `get_country_databank` | Get statistics for a country (population, GDP, climate indicators, etc.) |
| `list_country_key_figures` | List headline key figures for a country |
| `list_country_snippets` | List short content highlights for a country page |
| `list_historical_disasters` | Get historical disaster records for a country |
| `get_country_income` | Get World Bank income classification data for a country |
| `list_regions` | List the five IFRC regions (Africa, Americas, Asia Pacific, Europe, MENA) |
| `get_region` | Get details for a specific region |
| `list_region_key_figures` | List key figures for a region |
| `list_districts` | List administrative sub-national districts within a country |

---

#### DREF

**DREF** stands for *Disaster Response Emergency Fund* — a fast-disbursing fund for smaller or early-stage disasters.

| Tool | Description |
|---|---|
| `list_active_drefs` | List currently active DREF operations |
| `list_completed_drefs` | List completed DREF operations |
| `list_dref_operational_updates` | List operational updates (progress reports) for a DREF |
| `list_dref_final_reports` | List final reports for completed DREFs |

---

#### Surge & Deployments

**Surge** refers to the rapid deployment of trained personnel and equipment to disaster-affected areas.

- **ERU** (*Emergency Response Unit*) — a self-sufficient team of specialists (logistics, water/sanitation, IT, etc.)
- **Surge alert** — a call for volunteers or specialists to deploy

| Tool | Description |
|---|---|
| `list_surge_alerts` | List active or historical surge deployment alerts |
| `list_eru` | List Emergency Response Units (filter by event, country, type) |
| `list_eru_owners` | List the National Societies that own ERUs |
| `list_personnel` | List deployed surge personnel/delegates |
| `list_personnel_deployments` | List personnel deployment records |
| `list_partner_deployments` | List deployments by partner National Societies |
| `get_aggregated_eru_rapid_response` | Get aggregated ERU and rapid response statistics |

---

#### Flash Updates & Situation Reports

| Tool | Description |
|---|---|
| `list_flash_updates` | List flash updates (rapid situation summaries, typically first 72 hours) |
| `get_flash_update` | Get a single flash update |
| `list_situation_reports` | List longer-form situation reports for an appeal or event |
| `list_situation_report_types` | List the different types of situation reports |

---

#### Projects (3W)

**3W** (*Who does What Where*) is a coordination tool that tracks which organisations are running which activities in which locations.

| Tool | Description |
|---|---|
| `list_projects` | List 3W projects with filters (country, region, sector, status) |
| `get_project` | Get full details for a single project |
| `list_emergency_projects` | List in-field emergency response activity projects |
| `list_regional_projects` | List regional-level projects |

---

#### PER (Preparedness for Effective Response)

**PER** is IFRC's framework for helping National Societies assess and strengthen their disaster preparedness capacity.

| Tool | Description |
|---|---|
| `list_per_overviews` | List PER cycle overviews by country |
| `list_per_process_status` | List PER process statuses by country |
| `list_public_per_process_status` | Same as above, public/unauthenticated view |
| `get_per_stats` | Get PER statistics for a country |
| `get_public_per_stats` | Get public PER statistics for a country |
| `list_per_assessments` | List assessment responses for a PER cycle |
| `list_per_prioritizations` | List prioritized components from a PER cycle |
| `list_per_work_plans` | List work plans derived from a PER cycle |
| `list_per_form_areas` | List the top-level areas in the PER assessment framework |
| `list_per_form_components` | List components within a PER form area |
| `list_per_form_questions` | List assessment questions within a PER component |

---

#### Local Units

**Local units** are the branches and offices of National Societies within a country.

| Tool | Description |
|---|---|
| `list_local_units` | List National Society local units/branches |
| `list_public_local_units` | List public local units (no authentication required) |
| `list_health_local_units` | List health-focused local units |

---

#### Early Action Protocols (EAP)

**EAPs** are pre-agreed plans that trigger automatic funding and actions when a forecast threshold is met — before a disaster strikes.

| Tool | Description |
|---|---|
| `list_active_eaps` | List currently active Early Action Protocols |
| `get_simplified_eap` | Get a simplified summary of an EAP |
| `get_full_eap` | Get the complete EAP with all details |

---

#### Operations Learning

| Tool | Description |
|---|---|
| `list_ops_learning` | List lessons learned extracted from operation reviews and evaluations |

---

#### National Society Links & Partners

| Tool | Description |
|---|---|
| `list_nslinks` | List websites and links for National Societies |
| `list_external_partners` | List external partner organisations |
| `list_supported_activities` | List supported activity types |

---

## Monty MCP Server

### About

This server connects Claude to the **Montandon STAC API** — a geospatial catalog of disaster event datasets built on the [STAC specification](https://stacspec.org). It lets you browse and search collections of earth observation and disaster data.

**STAC** (*SpatioTemporal Asset Catalog*) is an open standard for cataloguing geospatial data. Think of a *collection* as a dataset category, and an *item* as a single event or record within that category, with attached files (images, shapefiles, etc.) called *assets*.

Example questions you can ask Claude:
- *"List all available Monty data collections."*
- *"Search for flood events in East Africa in 2024."*
- *"What items are in the DesInventar collection?"*

### Available Tools

---

#### API Status

| Tool | Description |
|---|---|
| `get_stac_root` | Get the API root/landing page (shows all capabilities and links) |
| `get_conformance` | List the OGC API conformance classes this server supports |
| `ping` | Quick check that the API is up and reachable |
| `get_health` | Get detailed system health/status of the API |

---

#### Collections

A **collection** groups related STAC items together — for example, all earthquake events from a particular source.

| Tool | Description |
|---|---|
| `list_collections` | List all available data collections |
| `get_collection` | Get metadata and details for a specific collection |
| `create_collection` | Create a new STAC collection |
| `update_collection` | Replace an existing collection entirely |
| `patch_collection` | Partially update a collection |
| `delete_collection` | Delete a collection |

---

#### Items

An **item** is a single record within a collection — for example, one earthquake event, with its geometry, date, and links to associated data files.

| Tool | Description |
|---|---|
| `list_collection_items` | List items in a collection (supports bbox and datetime filters) |
| `get_collection_item` | Get a specific item by ID |
| `create_item` | Add a new item to a collection |
| `update_item` | Replace an existing item entirely |
| `patch_item` | Partially update an item |
| `delete_item` | Delete an item from a collection |
| `bulk_create_items` | Add many items to a collection in a single request |

---

#### Search

| Tool | Description |
|---|---|
| `search_items` | Search items across collections using spatial, temporal, and property filters (recommended for complex queries) |
| `search_items_get` | Simpler search using URL query parameters (good for quick lookups) |

The `search_items` tool supports:
- `bbox` — bounding box filter (west, south, east, north)
- `datetime` — date or interval, e.g. `"2024-01-01/2024-12-31"`
- `collections` — limit search to specific collections
- `intersects` — GeoJSON geometry for spatial intersection
- `filter` — CQL2 expressions for advanced property filtering

---

#### Queryables

**Queryables** are the item properties you can filter on when searching.

| Tool | Description |
|---|---|
| `get_queryables` | List all globally filterable item properties |
| `get_collection_queryables` | List filterable properties for a specific collection |

---

## HDX HAPI MCP Server

### About

This server connects Claude to the **OCHA Humanitarian Data Exchange API** ([HDX HAPI](https://hapi.humdata.org)) — a structured, cross-country dataset covering the key indicators humanitarian responders rely on. Data is sourced from UNHCR, WFP, ACLED, IPC, and other authoritative providers.

Example questions you can ask Claude:
- *"How many IDPs are there in South Sudan, broken down by province?"*
- *"What is the food security situation in Somalia right now?"*
- *"Show me conflict events in Sudan in 2024."*
- *"Which organisations are operating in the health sector in Afghanistan?"*
- *"What is the humanitarian funding coverage for Yemen's HRP?"*
- *"Get rainfall anomaly data for the Sahel for the last 3 months."*

### Getting an HDX App Identifier

The HDX HAPI requires a free **app identifier** (a base64-encoded string) instead of a traditional API key:

1. Go to the [HDX HAPI identifier encoder](https://hapi.humdata.org/docs#/Util/get_encoded_identifier_api_v1_encode_identifier_get)
2. Enter your name, organisation, and email address
3. Copy the resulting base64 string
4. Add it to your `.env` file as `HDX_API_TOKEN=<your_string>`

### Available Tools

The tools are grouped by data category.

---

#### Metadata

| Tool | Description |
|---|---|
| `get_locations` | Get country and country-like location metadata with ISO3 codes and p-codes |
| `get_admin1` | Get first-level administrative divisions (provinces, states, regions) |
| `get_admin2` | Get second-level administrative divisions (districts, counties) |
| `get_datasets` | Get HDX dataset metadata including titles, providers, and source links |
| `get_resources` | Get HDX resource metadata including format, update dates, and HXL compliance |
| `get_data_availability` | Check which data categories are available by country and administrative level |
| `get_sectors` | Get humanitarian sector codes (Health, Education, Food Security, Shelter, WASH, etc.) |
| `get_organizations` | Get humanitarian organisations with acronyms and OCHA type classifications |
| `get_org_types` | Get organisation type classification codes (OCHA standards) |
| `get_currencies` | Get ISO-4217 currency codes used in WFP food price data |
| `get_wfp_commodities` | Get WFP food commodity codes, names, and categories |
| `get_wfp_markets` | Get WFP market locations with GPS coordinates and administrative hierarchy |

---

#### Coordination & Context

| Tool | Description |
|---|---|
| `get_operational_presence` | Get 3W/4W/5W data — which organisations are working where and in which sectors |
| `get_funding` | Get humanitarian appeal funding data: requirements, received amounts, and coverage % |
| `get_conflict_events` | Get ACLED conflict event data by country, event type (`political_violence`, `civilian_targeting`, `demonstration`), and date range |
| `get_national_risk` | Get INFORM Risk Index scores and classifications (1=Very Low to 5=Very High) |

---

#### Affected People

| Tool | Description |
|---|---|
| `get_idps` | Get IDP (Internally Displaced Persons) population data by country and administrative level |
| `get_refugees` | Get UNHCR refugee and persons-of-concern data by origin/asylum country, gender, and age |
| `get_returnees` | Get UNHCR returnee data (people who returned to their place of origin) |
| `get_humanitarian_needs` | Get HNO data: people affected, in-need, targeted, and reached by sector and location |

The `get_humanitarian_needs` tool uses population status codes: `AFF`=Affected, `INN`=In-Need, `TGT`=Targeted, `REA`=Reached.

---

#### Food Security, Nutrition & Poverty

| Tool | Description |
|---|---|
| `get_food_security` | Get IPC/CH food security phase data (1=Minimal through 5=Famine/Catastrophe) |
| `get_food_prices` | Get WFP VAM food price market monitor data by country, market, and commodity |
| `get_poverty_rate` | Get multidimensional poverty rate (MPI) data by country and admin1 division |

---

#### Population

| Tool | Description |
|---|---|
| `get_population` | Get population data disaggregated by country, administrative level, gender, and age group |

---

#### Climate

| Tool | Description |
|---|---|
| `get_rainfall` | Get satellite-derived rainfall data with long-term averages and anomaly percentages, aggregated by dekad (10-day), 1-month, or 3-month periods |

---

## UNHCR Refugee Statistics MCP Server

### About

This server connects Claude to the [UNHCR Population Statistics API](https://api.unhcr.org/population/v1) — the authoritative global dataset on refugees, asylum seekers, internally displaced persons, stateless persons, and persons of concern. The API is fully public and requires no authentication.

Example questions you can ask Claude:
- *"How many refugees from Syria are currently in Turkey?"*
- *"Show me asylum application trends in Germany over the last five years."*
- *"What durable solutions were recorded for Afghan refugees in 2023?"*
- *"Get the demographic breakdown of IDPs in South Sudan by age and sex."*
- *"What are the latest UNHCR nowcasting estimates for Somalia?"*

### Available Tools

---

#### Population & Displacement

| Tool | Description |
|---|---|
| `get_population` | Get refugee and displaced population figures (refugees, asylum seekers, IDPs, stateless persons, etc.) by year and country of origin/asylum. Supports filtering by `columns` to select specific population types |
| `get_demographics` | Get sub-national and demographic population data disaggregated by age, sex, and population type |
| `get_idmc` | Get IDMC (Internal Displacement Monitoring Centre) data on internally displaced persons by country and year |
| `get_unrwa` | Get UNRWA registered Palestine refugee population figures by year and territory |
| `get_nowcasting` | Get UNHCR nowcasting/predictive refugee population estimates for the current period |

---

#### Asylum

| Tool | Description |
|---|---|
| `get_asylum_applications` | Get asylum claims submitted by year and countries of asylum/origin |
| `get_asylum_decisions` | Get decisions taken on asylum claims — recognized, rejected, complementary protection, etc. — by year and country |

---

#### Durable Solutions

| Tool | Description |
|---|---|
| `get_solutions` | Get durable solutions data: voluntary repatriation, resettlement, and naturalization figures by year and country |

---

#### Reference Data

| Tool | Description |
|---|---|
| `list_countries` | List all countries with their UNHCR codes, ISO codes, names, and regional groupings — use this to look up country codes for other queries |
| `list_regions` | List all UNHCR regional bureaux/geographic regions with their IDs and names |
| `list_years` | List all years for which refugee statistics data is available |
| `get_footnotes` | Get methodology notes and data caveats explaining definitions and data sources for specific country-year combinations |

---

**Common filter parameters** available across most data tools:

| Parameter | Description |
|---|---|
| `coo` | Country of origin — 3-char UNHCR code(s), comma-separated (e.g. `AFG,SYR`) |
| `coa` | Country of asylum — 3-char UNHCR code(s), comma-separated |
| `yearFrom` / `yearTo` | Year range (inclusive) |
| `year` | Specific year(s), comma-separated (e.g. `2020,2021`) |
| `cfType` | Set to `ISO` to use ISO3 country codes instead of UNHCR codes |
| `limit` / `page` | Pagination controls |

---

## UNHCR Resettlement Data MCP Server

### About

This server connects Claude to the [UNHCR Resettlement Statistics (RSQ) API](https://api.unhcr.org/rsq/v1) — a dedicated dataset tracking formal resettlement programmes: UNHCR submissions to resettlement countries and actual departures. The API is fully public and requires no authentication.

**Resettlement** is one of UNHCR's three durable solutions. It involves transferring refugees from a country of asylum to a third country that has agreed to admit them. The RSQ API tracks both *submissions* (UNHCR referrals to a resettlement state) and *departures* (persons who have actually left for the resettlement country).

Example questions you can ask Claude:
- *"How many refugees were submitted for resettlement to Canada in 2023?"*
- *"Show me resettlement departure trends from Kenya to the US over the last decade."*
- *"What is the age and gender breakdown of resettlement submissions from Afghanistan?"*
- *"Which countries received the most resettlement departures in 2022?"*

### Available Tools

---

#### Lookup — Reference Data

| Tool | Description |
|---|---|
| `get_resettlement_categories` | Get all UNHCR resettlement submission category codes and names (e.g. NEED, SML, WOM) |
| `get_rsq_regions` | Get UNHCR regional groupings used to categorise countries of asylum |
| `get_rsq_years` | Get available years for which resettlement submissions and departures data exist |
| `get_rsq_years_demographics` | Get available years for which resettlement demographics data exists |
| `get_countries_of_asylum` | Get all available countries of asylum in the resettlement dataset |
| `get_origin_countries_submissions` | Get countries of origin that have resettlement submissions data |
| `get_origin_countries_departures` | Get countries of origin that have resettlement departures data |
| `get_origin_countries_demographics` | Get countries of origin that have resettlement demographics data |
| `get_resettlement_destinations` | Get all available resettlement destination countries |

---

#### Query — Submissions & Departures

| Tool | Description |
|---|---|
| `get_resettlement_submissions` | Get paginated resettlement submissions data (UNHCR referrals to resettlement countries). Returns 20 results per page. Filter by year, country of origin, country of asylum, and destination |
| `get_resettlement_departures` | Get paginated resettlement departures data (persons who actually departed to resettlement countries). Returns 20 results per page. Filter by year, country of origin, country of asylum, and destination |
| `get_resettlement_demographics` | Get resettlement submissions demographic breakdown by age and gender. Filter by year, country of origin, and resettlement destination |

---

#### Utilities

| Tool | Description |
|---|---|
| `resolve_rsq_url_hash` | Decode a UNHCR RSQ URL hash back into its full query URL — useful for reconstructing saved queries |
| `export_rsq_csv` | Export resettlement query results as a CSV. Specify `type` as `submissions` or `departures` and apply any filters |

---

**Common filter parameters** available across query tools:

| Parameter | Description |
|---|---|
| `year` | Year(s), comma-separated (e.g. `2022,2023`) |
| `origin` | Country of origin code(s), comma-separated |
| `asylum` | Country of asylum code(s), comma-separated |
| `resettlement` | Resettlement destination country code(s), comma-separated |
| `page` | Pagination page number (20 results per page) |
| `language` | Response language: `en` (default) or `fr` |

---

## Troubleshooting

### IFRC GO Server

**`FATAL: Cannot start server. Missing IFRC_API_TOKEN`**
Your `.env` file is missing or doesn't contain `IFRC_API_TOKEN`. Check that the file exists in the root `MCPs/` folder (or inside `ifrc-mcp/`) and contains a line like `IFRC_API_TOKEN=abc123...`.

**`API Error 401`**
Your token is invalid or has expired. Log in to [go.ifrc.org](https://go.ifrc.org) and regenerate your API token.

**`API Error 404`**
The server is configured to use `https://goadmin.ifrc.org`. If you're hitting 404 errors, make sure you have not edited the base URL in `server.js` to point to the old `https://go-api.ifrc.org` host.

**`Failed to install dependencies`** (IFRC server only)
The IFRC server tries to auto-install its dependencies if they're missing. If this fails, run `npm install` manually from the `ifrc-mcp/` folder.

### HDX HAPI Server

**`FATAL: Cannot start. HDX_API_TOKEN not found`**
Your `.env` file is missing or doesn't contain `HDX_API_TOKEN`. Get your free app identifier at [hapi.humdata.org](https://hapi.humdata.org/docs#/Util/get_encoded_identifier_api_v1_encode_identifier_get).

**`API Error 401` or `403`**
Your app identifier is invalid or malformed. Make sure you copied the full base64 string from the HDX identifier encoder without any extra spaces or line breaks.

**`API Error 422`**
A parameter value is invalid — check the allowed values for filters like `ipc_phase`, `population_group`, or `event_type` in the tool descriptions above.

### UNHCR Servers

**`API Error 400`**
A filter parameter is invalid. Check that country codes are valid 3-character UNHCR or ISO3 codes (use `list_countries` to look them up), and that year values are integers within the available range (use `list_years` to check).

**`Empty results`**
The UNHCR Population and RSQ APIs only return data for country-year combinations that exist in the database. Try broadening your filters or removing the `coo`/`coa` constraints to confirm data exists for your query.

### All Servers

**Tools don't appear in Claude Desktop**
- Make sure you saved the config file and fully restarted Claude Desktop (quit, don't just close the window).
- Check that the file paths in the config exactly match where you cloned this repository.
- On macOS you can verify paths by running `ls /YOUR/PATH/TO/MCPs/ifrc-mcp/server.js` in Terminal.
