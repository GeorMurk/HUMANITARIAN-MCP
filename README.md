# Humanitarian Data MCP Servers

<p align="center">
  <a href="https://www.ifrc.org"><img src="https://github.com/IFRCGo.png?size=120" alt="IFRC" height="80"/></a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://www.unhcr.org"><img src="https://github.com/unhcr-dataviz.png?size=120" alt="UNHCR" height="80"/></a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://data.humdata.org"><img src="https://github.com/OCHA-DAP.png?size=120" alt="HDX / OCHA" height="80"/></a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://ipcinfo.org"><img src="https://www.ipcinfo.org/fileadmin/templates/ipcinfo-assets/SVG_120218/IPC_Interim_Logo_Blu_EN.png" alt="IPC" height="80"/></a>
</p>

<p align="center">
  <strong>Ideated while using <img src="https://github.com/anthropics.png?size=20" alt="Claude" height="16" style="vertical-align:middle"/> <a href="https://claude.ai">Claude</a> by Anthropic</strong><br/>
  These MCP servers act as linkages between LLMs/Agents and real-world humanitarian data APIs.<br/>
  They are compatible with any MCP-capable AI assistant or agent framework.
</p>

This repository contains eight **MCP servers** that connect LLMs/Agents to live humanitarian data — letting any MCP-compatible AI assistant query real-world disaster, displacement, food security, and resettlement data without copy-pasting or manual lookups.

---

## What is MCP?

**Model Context Protocol (MCP)** is an open standard that serves as a linkage layer between LLMs/Agents and external tools, APIs, and data sources. Instead of manually retrieving data and pasting it into a chat window, you install an MCP server once and any compatible AI assistant or agent can call it automatically — like a plugin system for AI. These servers were ideated for [Claude](https://claude.ai) <img src="https://github.com/anthropics.png?size=20" alt="Claude" height="14" style="vertical-align:middle"/> but follow the open MCP standard and work with any LLM or agent that supports the protocol.

---

## What's in this repo?

| Server                           | Folder                    | What it does                                                                                                                                                                            |
| -------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IFRC GO MCP**                  | `ifrc-mcp/`               | Query the IFRC Global Operations platform — appeals, emergencies, field reports, deployed personnel, country profiles, and more                                                         |
| **Monty MCP**                    | `monty-mcp/`              | Query the Montandon STAC API — geospatial disaster event catalogs and datasets                                                                                                          |
| **HDX HAPI MCP**                 | `hdx-mcp/`                | Query the OCHA Humanitarian Data Exchange API — population, displacement, food security, conflict, funding, and climate data                                                            |
| **UNHCR Refugee Statistics MCP** | `unhcr-refugees-mcp/`     | Query the UNHCR Population Statistics API — refugee and displaced population figures, asylum applications/decisions, durable solutions, and demographics                                |
| **UNHCR Resettlement Data MCP**  | `unhcr-resettlement-mcp/` | Query the UNHCR Resettlement Statistics (RSQ) API — submissions, departures, and demographic breakdowns for resettlement programmes                                                     |
| **FEWS NET FDW MCP**             | `fewsnet-mcp/`            | Query the FEWS NET Famine Early Warning Systems Network API — IPC food security classifications, market prices, crop production, nutrition, trade flows, and humanitarian response data |
| **IPC-CH MCP**                   | `ipc-mcp/`                | Query the IPC-CH Public API — official IPC acute and chronic food insecurity analyses, area-level phase data, population tracking, and IDP point data                                   |
| **ReliefWeb MCP**                | `reliefweb-mcp/`          | Query the ReliefWeb API — humanitarian reports, situation reports, maps, disaster pages, country profiles, job listings, training opportunities, and taxonomy reference data from 4,000+ sources |

**IFRC** stands for the _International Federation of Red Cross and Red Crescent Societies_. The **GO** (Global Operations)[IFRC GO](https://go.ifrc.org) platform is a public database tracking humanitarian operations, disaster appeals, field reports, and response activities worldwide.

**Monty** (short for Montandon) [Monty](https://go.ifrc.org/montandon-landing) is a geospatial data API built on the **STAC** standard (_SpatioTemporal Asset Catalog_) — a common format for cataloguing earth observation and disaster-related datasets.

**HDX HAPI** is the [Humanitarian Data Exchange](https://data.humdata.org) API run by OCHA (UN Office for the Coordination of Humanitarian Affairs). It provides structured, cross-country access to humanitarian indicators: displacement figures, food security phases, conflict events, funding coverage, population statistics, and more.

**UNHCR** is the _UN Refugee Agency_. Their **Population Statistics API** exposes the global refugee database — figures on refugees, asylum seekers, IDPs, stateless persons, and durable solutions going back decades. Their **Resettlement (RSQ) API** covers submissions and departures for formal resettlement programmes worldwide. Both APIs are fully public and require no authentication.

**IPC-CH** is the [Integrated Food Security Phase Classification](https://ipcinfo.org) — the global standard for classifying acute and chronic food insecurity. Their Public API provides official analyses, sub-national area phase data, population estimates, and IDP point data across crisis-affected countries.

**ReliefWeb** is OCHA's leading online platform for reliable and timely humanitarian information. It aggregates reports, situation reports, maps, press releases, jobs, and training opportunities from 4,000+ trusted sources — UN agencies, NGOs, governments, and research institutions — covering disasters, crises, and humanitarian themes worldwide. Their API provides full-text search, rich filtering, faceting, and taxonomy reference data.

---

## Prerequisites

Before you start, make sure you have:

- **Node.js** v18 or later — download from [nodejs.org](https://nodejs.org)
- **npm** — comes bundled with Node.js
- **Claude Desktop** <img src="https://github.com/anthropics.png?size=20" alt="Claude" height="14" style="vertical-align:middle"/> — the Mac/Windows app from [claude.ai](https://claude.ai), or any other MCP-compatible LLM/Agent host
- **An IFRC GO API token** — create a free account at [go.ifrc.org](https://go.ifrc.org) and generate a token from your profile settings
- **An HDX app identifier** — register your app at [hapi.humdata.org](https://hapi.humdata.org/docs#/Util/get_encoded_identifier_api_v1_encode_identifier_get) to get a free base64-encoded identifier
- **A FEWS NET FDW account** — register at [fdw.fews.net](https://fdw.fews.net) to obtain a username and password
- **An IPC API key** — register at [ipcinfo.org](https://ipcinfo.org) to obtain a free API key
- **A ReliefWeb app name** — register a free app name at [apidoc.reliefweb.int](https://apidoc.reliefweb.int/) (used as an identifier in API requests, not a secret key)

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

# Required by FEWS NET FDW server
FEWSNET_USERNAME=your_fewsnet_username_here
FEWSNET_PASSWORD=your_fewsnet_password_here

# Required by IPC-CH server
IPC_API_KEY=your_ipc_api_key_here

# Required by ReliefWeb server
RELIEFWEB_APPNAME=your-app-name-here
```

Replace the placeholder values with your actual tokens. The UNHCR servers need no entries in this file.

> **Tip:** You can also place the `.env` file inside an individual server folder (e.g., `hdx-mcp/`). Each server searches in multiple locations.

### 3. Install dependencies for each server

```bash
cd ifrc-mcp && npm install && cd ..
cd monty-mcp && npm install && cd ..
cd hdx-mcp && npm install && cd ..
cd unhcr-refugees-mcp && npm install && cd ..
cd unhcr-resettlement-mcp && npm install && cd ..
cd fewsnet-mcp && npm install && cd ..
cd ipc-mcp && npm install && cd ..
cd reliefweb-mcp && npm install && cd ..
```

---

## Configure Your LLM/Agent Host

These servers work with any MCP-compatible LLM or agent framework. The example below shows configuration for **Claude Desktop** <img src="https://github.com/anthropics.png?size=20" alt="Claude" height="14" style="vertical-align:middle"/>, which was the primary host these servers were developed and tested against.

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
      "args": ["/YOUR/PATH/TO/MCPs/unhcr-resettlement-mcp/server.js"]
    },
    "fewsnet": {
      "command": "node",
      "args": ["/YOUR/PATH/TO/MCPs/fewsnet-mcp/server.js"]
    },
    "ipc-ch": {
      "command": "node",
      "args": ["/YOUR/PATH/TO/MCPs/ipc-mcp/server.js"]
    },
    "reliefweb": {
      "command": "node",
      "args": ["/YOUR/PATH/TO/MCPs/reliefweb-mcp/server.js"]
    }
  }
}
```

After saving, **restart Claude Desktop** (or your MCP-compatible agent host). You should see all eight servers' tools available in the tools panel.

> **Other MCP hosts:** If you are connecting these servers to a different LLM or agent framework (e.g. a custom agent built with the MCP SDK, or another Claude-compatible tool), consult that framework's documentation for how to register stdio-transport MCP servers.

---

## IFRC GO MCP Server

### About

This server links LLMs/Agents to the [IFRC GO API](https://goadmin.ifrc.org) — a comprehensive database of humanitarian operations run by the Red Cross and Red Crescent network. You can ask an AI assistant questions like:

- _"What emergency appeals are active in Sudan right now?"_
- _"Show me the disaster history for Kenya in 2023."_
- _"List all surge personnel currently deployed to Turkey."_
- _"What DREFs are active in the Asia Pacific region?"_

### Available Tools

The tools are grouped by topic below. Each tool corresponds to an endpoint on the IFRC GO API.

---

#### Search

| Tool          | Description                                   |
| ------------- | --------------------------------------------- |
| `search_ifrc` | Global keyword search across all IFRC GO data |

---

#### Appeals

An **appeal** is a formal request for funding to respond to a disaster. Types include DREF (small/fast funding), Emergency Appeal, and International Appeal.

| Tool                    | Description                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| `list_appeals`          | List/search appeals with filters (country, region, type, status, disaster type) |
| `get_appeal`            | Get full details for a single appeal by its ID                                  |
| `list_appeal_documents` | List documents (PDFs, reports) attached to an appeal                            |

---

#### Events & Emergencies

An **event** is a recorded disaster or emergency in the IFRC system.

| Tool                  | Description                                                                     |
| --------------------- | ------------------------------------------------------------------------------- |
| `list_events`         | List emergency events with filters (country, region, disaster type, date range) |
| `get_event`           | Get full details for a single emergency event                                   |
| `list_disaster_types` | List all disaster/hazard categories (earthquake, flood, etc.)                   |
| `list_go_historical`  | List historical GO emergency records by country                                 |

---

#### Field Reports

**Field reports** are early assessments submitted by National Societies when a disaster occurs.

| Tool                 | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `list_field_reports` | List field reports with filters (country, event, disaster type, date range) |
| `get_field_report`   | Get full details for a single field report                                  |

---

#### Countries & Regions

| Tool                        | Description                                                               |
| --------------------------- | ------------------------------------------------------------------------- |
| `list_countries`            | List countries with optional filters (name, ISO code, region)             |
| `get_country_profile`       | Get detailed information about a specific country                         |
| `get_country_databank`      | Get statistics for a country (population, GDP, climate indicators, etc.)  |
| `list_country_key_figures`  | List headline key figures for a country                                   |
| `list_country_snippets`     | List short content highlights for a country page                          |
| `list_historical_disasters` | Get historical disaster records for a country                             |
| `get_country_income`        | Get World Bank income classification data for a country                   |
| `list_regions`              | List the five IFRC regions (Africa, Americas, Asia Pacific, Europe, MENA) |
| `get_region`                | Get details for a specific region                                         |
| `list_region_key_figures`   | List key figures for a region                                             |
| `list_districts`            | List administrative sub-national districts within a country               |

---

#### DREF

**DREF** stands for _Disaster Response Emergency Fund_ — a fast-disbursing fund for smaller or early-stage disasters.

| Tool                            | Description                                            |
| ------------------------------- | ------------------------------------------------------ |
| `list_active_drefs`             | List currently active DREF operations                  |
| `list_completed_drefs`          | List completed DREF operations                         |
| `list_dref_operational_updates` | List operational updates (progress reports) for a DREF |
| `list_dref_final_reports`       | List final reports for completed DREFs                 |

---

#### Surge & Deployments

**Surge** refers to the rapid deployment of trained personnel and equipment to disaster-affected areas.

- **ERU** (_Emergency Response Unit_) — a self-sufficient team of specialists (logistics, water/sanitation, IT, etc.)
- **Surge alert** — a call for volunteers or specialists to deploy

| Tool                                | Description                                                    |
| ----------------------------------- | -------------------------------------------------------------- |
| `list_surge_alerts`                 | List active or historical surge deployment alerts              |
| `list_eru`                          | List Emergency Response Units (filter by event, country, type) |
| `list_eru_owners`                   | List the National Societies that own ERUs                      |
| `list_personnel`                    | List deployed surge personnel/delegates                        |
| `list_personnel_deployments`        | List personnel deployment records                              |
| `list_partner_deployments`          | List deployments by partner National Societies                 |
| `get_aggregated_eru_rapid_response` | Get aggregated ERU and rapid response statistics               |

---

#### Flash Updates & Situation Reports

| Tool                          | Description                                                              |
| ----------------------------- | ------------------------------------------------------------------------ |
| `list_flash_updates`          | List flash updates (rapid situation summaries, typically first 72 hours) |
| `get_flash_update`            | Get a single flash update                                                |
| `list_situation_reports`      | List longer-form situation reports for an appeal or event                |
| `list_situation_report_types` | List the different types of situation reports                            |

---

#### Projects (3W)

**3W** (_Who does What Where_) is a coordination tool that tracks which organisations are running which activities in which locations.

| Tool                      | Description                                                     |
| ------------------------- | --------------------------------------------------------------- |
| `list_projects`           | List 3W projects with filters (country, region, sector, status) |
| `get_project`             | Get full details for a single project                           |
| `list_emergency_projects` | List in-field emergency response activity projects              |
| `list_regional_projects`  | List regional-level projects                                    |

---

#### PER (Preparedness for Effective Response)

**PER** is IFRC's framework for helping National Societies assess and strengthen their disaster preparedness capacity.

| Tool                             | Description                                              |
| -------------------------------- | -------------------------------------------------------- |
| `list_per_overviews`             | List PER cycle overviews by country                      |
| `list_per_process_status`        | List PER process statuses by country                     |
| `list_public_per_process_status` | Same as above, public/unauthenticated view               |
| `get_per_stats`                  | Get PER statistics for a country                         |
| `get_public_per_stats`           | Get public PER statistics for a country                  |
| `list_per_assessments`           | List assessment responses for a PER cycle                |
| `list_per_prioritizations`       | List prioritized components from a PER cycle             |
| `list_per_work_plans`            | List work plans derived from a PER cycle                 |
| `list_per_form_areas`            | List the top-level areas in the PER assessment framework |
| `list_per_form_components`       | List components within a PER form area                   |
| `list_per_form_questions`        | List assessment questions within a PER component         |

---

#### Local Units

**Local units** are the branches and offices of National Societies within a country.

| Tool                      | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `list_local_units`        | List National Society local units/branches           |
| `list_public_local_units` | List public local units (no authentication required) |
| `list_health_local_units` | List health-focused local units                      |

---

#### Early Action Protocols (EAP)

**EAPs** are pre-agreed plans that trigger automatic funding and actions when a forecast threshold is met — before a disaster strikes.

| Tool                 | Description                                  |
| -------------------- | -------------------------------------------- |
| `list_active_eaps`   | List currently active Early Action Protocols |
| `get_simplified_eap` | Get a simplified summary of an EAP           |
| `get_full_eap`       | Get the complete EAP with all details        |

---

#### Operations Learning

| Tool                | Description                                                           |
| ------------------- | --------------------------------------------------------------------- |
| `list_ops_learning` | List lessons learned extracted from operation reviews and evaluations |

---

#### National Society Links & Partners

| Tool                        | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `list_nslinks`              | List websites and links for National Societies |
| `list_external_partners`    | List external partner organisations            |
| `list_supported_activities` | List supported activity types                  |

---

## Monty MCP Server

### About

This server links LLMs/Agents to the **Montandon STAC API** — a geospatial catalog of disaster event datasets built on the [STAC specification](https://stacspec.org). It lets you browse and search collections of earth observation and disaster data.

**STAC** (_SpatioTemporal Asset Catalog_) is an open standard for cataloguing geospatial data. Think of a _collection_ as a dataset category, and an _item_ as a single event or record within that category, with attached files (images, shapefiles, etc.) called _assets_.

Example questions you can ask an AI assistant:

- _"List all available Monty data collections."_
- _"Search for flood events in East Africa in 2024."_
- _"What items are in the DesInventar collection?"_

### Available Tools

---

#### API Status

| Tool              | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `get_stac_root`   | Get the API root/landing page (shows all capabilities and links) |
| `get_conformance` | List the OGC API conformance classes this server supports        |
| `ping`            | Quick check that the API is up and reachable                     |
| `get_health`      | Get detailed system health/status of the API                     |

---

#### Collections

A **collection** groups related STAC items together — for example, all earthquake events from a particular source.

| Tool                | Description                                        |
| ------------------- | -------------------------------------------------- |
| `list_collections`  | List all available data collections                |
| `get_collection`    | Get metadata and details for a specific collection |
| `create_collection` | Create a new STAC collection                       |
| `update_collection` | Replace an existing collection entirely            |
| `patch_collection`  | Partially update a collection                      |
| `delete_collection` | Delete a collection                                |

---

#### Items

An **item** is a single record within a collection — for example, one earthquake event, with its geometry, date, and links to associated data files.

| Tool                    | Description                                                     |
| ----------------------- | --------------------------------------------------------------- |
| `list_collection_items` | List items in a collection (supports bbox and datetime filters) |
| `get_collection_item`   | Get a specific item by ID                                       |
| `create_item`           | Add a new item to a collection                                  |
| `update_item`           | Replace an existing item entirely                               |
| `patch_item`            | Partially update an item                                        |
| `delete_item`           | Delete an item from a collection                                |
| `bulk_create_items`     | Add many items to a collection in a single request              |

---

#### Search

| Tool               | Description                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `search_items`     | Search items across collections using spatial, temporal, and property filters (recommended for complex queries) |
| `search_items_get` | Simpler search using URL query parameters (good for quick lookups)                                              |

The `search_items` tool supports:

- `bbox` — bounding box filter (west, south, east, north)
- `datetime` — date or interval, e.g. `"2024-01-01/2024-12-31"`
- `collections` — limit search to specific collections
- `intersects` — GeoJSON geometry for spatial intersection
- `filter` — CQL2 expressions for advanced property filtering

---

#### Queryables

**Queryables** are the item properties you can filter on when searching.

| Tool                        | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| `get_queryables`            | List all globally filterable item properties         |
| `get_collection_queryables` | List filterable properties for a specific collection |

---

## HDX HAPI MCP Server

### About

This server links LLMs/Agents to the **OCHA Humanitarian Data Exchange API** ([HDX HAPI](https://hapi.humdata.org)) — a structured, cross-country dataset covering the key indicators humanitarian responders rely on. Data is sourced from UNHCR, WFP, ACLED, IPC, and other authoritative providers.

Example questions you can ask an AI assistant:

- _"How many IDPs are there in South Sudan, broken down by province?"_
- _"What is the food security situation in Somalia right now?"_
- _"Show me conflict events in Sudan in 2024."_
- _"Which organisations are operating in the health sector in Afghanistan?"_
- _"What is the humanitarian funding coverage for Yemen's HRP?"_
- _"Get rainfall anomaly data for the Sahel for the last 3 months."_

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

| Tool                    | Description                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `get_locations`         | Get country and country-like location metadata with ISO3 codes and p-codes            |
| `get_admin1`            | Get first-level administrative divisions (provinces, states, regions)                 |
| `get_admin2`            | Get second-level administrative divisions (districts, counties)                       |
| `get_datasets`          | Get HDX dataset metadata including titles, providers, and source links                |
| `get_resources`         | Get HDX resource metadata including format, update dates, and HXL compliance          |
| `get_data_availability` | Check which data categories are available by country and administrative level         |
| `get_sectors`           | Get humanitarian sector codes (Health, Education, Food Security, Shelter, WASH, etc.) |
| `get_organizations`     | Get humanitarian organisations with acronyms and OCHA type classifications            |
| `get_org_types`         | Get organisation type classification codes (OCHA standards)                           |
| `get_currencies`        | Get ISO-4217 currency codes used in WFP food price data                               |
| `get_wfp_commodities`   | Get WFP food commodity codes, names, and categories                                   |
| `get_wfp_markets`       | Get WFP market locations with GPS coordinates and administrative hierarchy            |

---

#### Coordination & Context

| Tool                       | Description                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `get_operational_presence` | Get 3W/4W/5W data — which organisations are working where and in which sectors                                                     |
| `get_funding`              | Get humanitarian appeal funding data: requirements, received amounts, and coverage %                                               |
| `get_conflict_events`      | Get ACLED conflict event data by country, event type (`political_violence`, `civilian_targeting`, `demonstration`), and date range |
| `get_national_risk`        | Get INFORM Risk Index scores and classifications (1=Very Low to 5=Very High)                                                       |

---

#### Affected People

| Tool                     | Description                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `get_idps`               | Get IDP (Internally Displaced Persons) population data by country and administrative level |
| `get_refugees`           | Get UNHCR refugee and persons-of-concern data by origin/asylum country, gender, and age    |
| `get_returnees`          | Get UNHCR returnee data (people who returned to their place of origin)                     |
| `get_humanitarian_needs` | Get HNO data: people affected, in-need, targeted, and reached by sector and location       |

The `get_humanitarian_needs` tool uses population status codes: `AFF`=Affected, `INN`=In-Need, `TGT`=Targeted, `REA`=Reached.

---

#### Food Security, Nutrition & Poverty

| Tool                | Description                                                                  |
| ------------------- | ---------------------------------------------------------------------------- |
| `get_food_security` | Get IPC/CH food security phase data (1=Minimal through 5=Famine/Catastrophe) |
| `get_food_prices`   | Get WFP VAM food price market monitor data by country, market, and commodity |
| `get_poverty_rate`  | Get multidimensional poverty rate (MPI) data by country and admin1 division  |

---

#### Population

| Tool             | Description                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------- |
| `get_population` | Get population data disaggregated by country, administrative level, gender, and age group |

---

#### Climate

| Tool           | Description                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_rainfall` | Get satellite-derived rainfall data with long-term averages and anomaly percentages, aggregated by dekad (10-day), 1-month, or 3-month periods |

---

## UNHCR Refugee Statistics MCP Server

### About

This server links LLMs/Agents to the [UNHCR Population Statistics API](https://api.unhcr.org/population/v1) — the authoritative global dataset on refugees, asylum seekers, internally displaced persons, stateless persons, and persons of concern. The API is fully public and requires no authentication.

Example questions you can ask an AI assistant:

- _"How many refugees from Syria are currently in Turkey?"_
- _"Show me asylum application trends in Germany over the last five years."_
- _"What durable solutions were recorded for Afghan refugees in 2023?"_
- _"Get the demographic breakdown of IDPs in South Sudan by age and sex."_
- _"What are the latest UNHCR nowcasting estimates for Somalia?"_

### Available Tools

---

#### Population & Displacement

| Tool               | Description                                                                                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_population`   | Get refugee and displaced population figures (refugees, asylum seekers, IDPs, stateless persons, etc.) by year and country of origin/asylum. Supports filtering by `columns` to select specific population types |
| `get_demographics` | Get sub-national and demographic population data disaggregated by age, sex, and population type                                                                                                                  |
| `get_idmc`         | Get IDMC (Internal Displacement Monitoring Centre) data on internally displaced persons by country and year                                                                                                      |
| `get_unrwa`        | Get UNRWA registered Palestine refugee population figures by year and territory                                                                                                                                  |
| `get_nowcasting`   | Get UNHCR nowcasting/predictive refugee population estimates for the current period                                                                                                                              |

---

#### Asylum

| Tool                      | Description                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `get_asylum_applications` | Get asylum claims submitted by year and countries of asylum/origin                                                |
| `get_asylum_decisions`    | Get decisions taken on asylum claims — recognized, rejected, complementary protection, etc. — by year and country |

---

#### Durable Solutions

| Tool            | Description                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `get_solutions` | Get durable solutions data: voluntary repatriation, resettlement, and naturalization figures by year and country |

---

#### Reference Data

| Tool             | Description                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `list_countries` | List all countries with their UNHCR codes, ISO codes, names, and regional groupings — use this to look up country codes for other queries |
| `list_regions`   | List all UNHCR regional bureaux/geographic regions with their IDs and names                                                               |
| `list_years`     | List all years for which refugee statistics data is available                                                                             |
| `get_footnotes`  | Get methodology notes and data caveats explaining definitions and data sources for specific country-year combinations                     |

---

**Common filter parameters** available across most data tools:

| Parameter             | Description                                                                |
| --------------------- | -------------------------------------------------------------------------- |
| `coo`                 | Country of origin — 3-char UNHCR code(s), comma-separated (e.g. `AFG,SYR`) |
| `coa`                 | Country of asylum — 3-char UNHCR code(s), comma-separated                  |
| `yearFrom` / `yearTo` | Year range (inclusive)                                                     |
| `year`                | Specific year(s), comma-separated (e.g. `2020,2021`)                       |
| `cfType`              | Set to `ISO` to use ISO3 country codes instead of UNHCR codes              |
| `limit` / `page`      | Pagination controls                                                        |

---

## UNHCR Resettlement Data MCP Server

### About

This server links LLMs/Agents to the [UNHCR Resettlement Statistics (RSQ) API](https://api.unhcr.org/rsq/v1) — a dedicated dataset tracking formal resettlement programmes: UNHCR submissions to resettlement countries and actual departures. The API is fully public and requires no authentication.

**Resettlement** is one of UNHCR's three durable solutions. It involves transferring refugees from a country of asylum to a third country that has agreed to admit them. The RSQ API tracks both _submissions_ (UNHCR referrals to a resettlement state) and _departures_ (persons who have actually left for the resettlement country).

Example questions you can ask an AI assistant:

- _"How many refugees were submitted for resettlement to Canada in 2023?"_
- _"Show me resettlement departure trends from Kenya to the US over the last decade."_
- _"What is the age and gender breakdown of resettlement submissions from Afghanistan?"_
- _"Which countries received the most resettlement departures in 2022?"_

### Available Tools

---

#### Lookup — Reference Data

| Tool                                | Description                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| `get_resettlement_categories`       | Get all UNHCR resettlement submission category codes and names (e.g. NEED, SML, WOM) |
| `get_rsq_regions`                   | Get UNHCR regional groupings used to categorise countries of asylum                  |
| `get_rsq_years`                     | Get available years for which resettlement submissions and departures data exist     |
| `get_rsq_years_demographics`        | Get available years for which resettlement demographics data exists                  |
| `get_countries_of_asylum`           | Get all available countries of asylum in the resettlement dataset                    |
| `get_origin_countries_submissions`  | Get countries of origin that have resettlement submissions data                      |
| `get_origin_countries_departures`   | Get countries of origin that have resettlement departures data                       |
| `get_origin_countries_demographics` | Get countries of origin that have resettlement demographics data                     |
| `get_resettlement_destinations`     | Get all available resettlement destination countries                                 |

---

#### Query — Submissions & Departures

| Tool                            | Description                                                                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_resettlement_submissions`  | Get paginated resettlement submissions data (UNHCR referrals to resettlement countries). Returns 20 results per page. Filter by year, country of origin, country of asylum, and destination              |
| `get_resettlement_departures`   | Get paginated resettlement departures data (persons who actually departed to resettlement countries). Returns 20 results per page. Filter by year, country of origin, country of asylum, and destination |
| `get_resettlement_demographics` | Get resettlement submissions demographic breakdown by age and gender. Filter by year, country of origin, and resettlement destination                                                                    |

---

#### Utilities

| Tool                   | Description                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `resolve_rsq_url_hash` | Decode a UNHCR RSQ URL hash back into its full query URL — useful for reconstructing saved queries                |
| `export_rsq_csv`       | Export resettlement query results as a CSV. Specify `type` as `submissions` or `departures` and apply any filters |

---

**Common filter parameters** available across query tools:

| Parameter      | Description                                               |
| -------------- | --------------------------------------------------------- |
| `year`         | Year(s), comma-separated (e.g. `2022,2023`)               |
| `origin`       | Country of origin code(s), comma-separated                |
| `asylum`       | Country of asylum code(s), comma-separated                |
| `resettlement` | Resettlement destination country code(s), comma-separated |
| `page`         | Pagination page number (20 results per page)              |
| `language`     | Response language: `en` (default) or `fr`                 |

---

## FEWS NET MCP Server

### About

This server links LLMs/Agents to the [FEWS NET Famine Early Warning Systems Network API](https://fdw.fews.net) — a comprehensive database of food security conditions, market prices, crop production, nutrition, and humanitarian response data across crisis-affected countries in Africa, Latin America, and Asia.

**FEWS NET** is a USAID-funded early warning system that monitors acute food insecurity. Its core output is the **IPC (Integrated Food Security Phase Classification)** — a standardised scale (Phase 1=Minimal to Phase 5=Famine/Catastrophe) used by governments, UN agencies, and NGOs to trigger and scale humanitarian response.

**Registration required:** Create a free account at [fdw.fews.net](https://fdw.fews.net), then add your username and password to the `.env` file.

Example questions you can ask an AI assistant:

- _"What is the current IPC food security situation in Ethiopia by region?"_
- _"Show me maize prices in Nairobi markets over the past year."_
- _"How many people are in IPC Phase 3 or above in Somalia?"_
- _"What are the latest crop production estimates for the East Africa region?"_
- _"Show me exchange rate trends for the South Sudanese Pound."_
- _"What humanitarian food assistance is being tracked in Yemen?"_

### Available Tools

---

#### Search

| Tool             | Description                                                                        |
| ---------------- | ---------------------------------------------------------------------------------- |
| `search_fewsnet` | Global search across all FEWS NET data (countries, markets, indicators, documents) |

---

#### IPC Food Security Classifications

The **IPC (Integrated Food Security Phase Classification)** is the primary output of FEWS NET — it classifies geographic areas on a 5-point scale of acute food insecurity severity. Phase 3+ (Crisis and above) is the threshold for humanitarian action.

**Scenarios:** `CS` = Current Situation (observed), `ML1` = Most Likely Near-Term Projection (~2 months), `ML2` = Most Likely Medium-Term Projection (~4–6 months).

| Tool                              | Description                                                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `get_ipc_phases`                  | Get IPC acute food insecurity phase data points — the core food security classification by geographic unit, period, and scenario |
| `get_ipc_package`                 | Get a complete IPC package for a country/period including all geographic levels                                                  |
| `get_ipc_classifications`         | List IPC classification data series metadata (which areas and periods are covered)                                               |
| `get_ipc_classification_datasets` | List IPC classification dataset metadata (collection dates, visibility, domain)                                                  |

---

#### IPC Population Estimates

| Tool                       | Description                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `get_ipc_population`       | List acutely food insecure population estimate data series by country, phase, or scenario |
| `get_ipc_population_sizes` | Get actual population size estimates in each IPC phase by geographic unit and period      |

---

#### Humanitarian Food Assistance

| Tool                                      | Description                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `get_humanitarian_food_assistance`        | List Humanitarian Food Assistance (HFA) data series — food aid pipeline and delivery information |
| `get_humanitarian_food_assistance_values` | Get HFA data point values — food aid quantities by area and period                               |

---

#### Market Prices

FEWS NET monitors prices of key food commodities (maize, sorghum, wheat, livestock, etc.) at hundreds of markets across crisis-affected countries.

| Tool                      | Description                                                                   |
| ------------------------- | ----------------------------------------------------------------------------- |
| `get_markets`             | List food markets monitored by FEWS NET with location and country information |
| `get_market_products`     | List commodities/products tracked at FEWS NET markets                         |
| `get_market_price_series` | List market price data series (metadata: which commodity at which market)     |
| `get_market_price_facts`  | Get actual observed prices for commodities at markets over time               |
| `get_price_datasets`      | List price dataset metadata (collection details, date ranges)                 |

---

#### Price Indices & Ratios

| Tool                                | Description                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `get_price_indices`                 | List secondary price index data series (e.g. wage-to-staple ratios, terms of trade) |
| `get_price_index_values`            | Get secondary price index values over time                                          |
| `get_calculated_price_indices`      | List composite price indices derived from multiple market prices                    |
| `get_calculated_price_index_values` | Get calculated price index values over time                                         |
| `get_price_ratios`                  | List calculated price ratio data series (e.g. cereal-to-livestock ratios)           |
| `get_price_ratio_values`            | Get price ratio values over time                                                    |

---

#### Exchange Rates

| Tool                       | Description                                                         |
| -------------------------- | ------------------------------------------------------------------- |
| `get_exchange_rates`       | List exchange rate data series (currency pairs tracked per country) |
| `get_exchange_rate_values` | Get exchange rate values over time                                  |

---

#### Crop Production

| Tool                                 | Description                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `get_crop_production_datasets`       | List crop production estimate datasets (survey metadata)                       |
| `get_crop_production_indicators`     | List crop production estimate data series (harvest estimates by crop and area) |
| `get_crop_production_values`         | Get actual crop production/harvest quantities by geographic unit and season    |
| `get_crop_yield_forecast_indicators` | List crop yield forecast data series (predictive yield models)                 |
| `get_crop_yield_forecast_values`     | Get projected yield quantities by area and crop                                |

---

#### Nutrition

| Tool                             | Description                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `get_nutrition_datasets`         | List nutrition survey datasets (SMART surveys, MICS, DHS)                      |
| `get_nutrition_indicators`       | List nutrition indicator data series (e.g. GAM, SAM rates by area)             |
| `get_nutrition_indicator_values` | Get nutrition indicator values — acute malnutrition (GAM, SAM) rates over time |

---

#### Population

| Tool                              | Description                                                        |
| --------------------------------- | ------------------------------------------------------------------ |
| `get_population_datasets`         | List population estimate and census datasets                       |
| `get_population_indicators`       | List population estimate data series by geographic unit            |
| `get_population_indicator_values` | Get population counts and projections by geographic unit over time |

---

#### Humanitarian Response

| Tool                    | Description                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| `get_response_datasets` | List humanitarian response datasets (food aid, cash transfers, etc.) |
| `get_responses`         | List humanitarian response data series by area                       |
| `get_response_values`   | Get response quantities/beneficiaries for food assistance programs   |

---

#### Trade Flows

| Tool                             | Description                                                             |
| -------------------------------- | ----------------------------------------------------------------------- |
| `get_trade_flow_datasets`        | List trade flow datasets (cross-border food commodity trade monitoring) |
| `get_trade_flow_quantities`      | List trade flow quantity data series (commodity flows between areas)    |
| `get_trade_flow_quantity_values` | Get actual cross-border commodity trade volumes by period and route     |

---

#### Commodity Balance

| Tool                          | Description                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `get_commodity_balances`      | List commodity balance data series — national/regional food balance sheet data |
| `get_commodity_balance_facts` | Get commodity balance values — production, imports, exports, and utilization   |

---

#### Surveys

| Tool                          | Description                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `get_surveys`                 | List household surveys used by FEWS NET                                                   |
| `get_survey_indicator_values` | Get survey indicator values from household surveys (food security, livelihood indicators) |

---

#### Geographic Reference Data

| Tool                       | Description                                                                    |
| -------------------------- | ------------------------------------------------------------------------------ |
| `get_countries`            | List all countries tracked by FEWS NET with ISO codes and metadata             |
| `get_country_groups`       | List country groups / regional groupings (e.g. IGAD, SADC, West Africa)        |
| `get_geographic_units`     | List FEWS NET geographic units (admin zones, livelihood zones) with FNID codes |
| `get_geographic_unit_sets` | List versioned administrative boundary sets used in FEWS NET data              |

---

#### Reference / Lookup Data

| Tool                      | Description                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `get_classified_products` | List CPC v2–classified food commodities tracked by FEWS NET                 |
| `get_currencies`          | List currencies tracked by FEWS NET with ISO 4217 codes                     |
| `get_units_of_measure`    | List units of measure used in FEWS NET data (kg, MT, litres, etc.)          |
| `get_scenarios`           | List IPC projection scenarios (CS, ML1, ML2)                                |
| `get_seasons`             | List agricultural seasons tracked by FEWS NET by country                    |
| `get_indicators`          | List all FEWS NET indicators (food security, market, nutrition, population) |

---

#### Assumptions & Narrative Documents

| Tool                           | Description                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `get_assumptions_reports`      | List FEWS NET assumptions reports — analytical narratives underpinning food security projections |
| `get_assumptions_report_items` | List individual findings/items within assumptions reports                                        |
| `get_narrative_metadata`       | List FEWS NET narrative metadata — food security outlook reports and situation narratives        |
| `get_source_documents`         | List data source documents referenced in FEWS NET datasets                                       |

---

**Common filter parameters** across most FEWS NET tools:

| Parameter                 | Description                                                               |
| ------------------------- | ------------------------------------------------------------------------- |
| `country_code`            | ISO 3166-1 alpha-2 code (e.g. `KE`, `ET`, `SO`, `SS`, `YE`)               |
| `fnid`                    | FEWS NET geographic unit identifier (e.g. `KE09` for a Kenyan admin zone) |
| `start_date` / `end_date` | Date range filter (`YYYY-MM-DD`)                                          |
| `period_date`             | Specific reference date for the data point (`YYYY-MM-DD`)                 |
| `scenario`                | IPC scenario: `CS` (current), `ML1` (near-term), `ML2` (medium-term)      |
| `page_size`               | Number of results per page                                                |
| `offset`                  | Pagination offset                                                         |

---

## IPC-CH MCP Server

### About

This server links LLMs/Agents to the [IPC-CH Public API](https://ipcinfo.org) — the official source for Integrated Food Security Phase Classification analyses. It provides both **Acute Food Insecurity (AFI)** and **Chronic Food Insecurity (CFI)** data at country and sub-national levels, including population estimates per phase, IDP point data, and phase-level icons.

**IPC** (_Integrated Food Security Phase Classification_) is a global initiative jointly developed by FAO, WFP, UNICEF, and partner agencies. It classifies food insecurity on a 5-point scale — Phase 1 (Minimal) through Phase 5 (Famine/Catastrophe) — and is the standard used by the humanitarian system to trigger and scale emergency response.

**Registration required:** Register at [ipcinfo.org](https://ipcinfo.org) to obtain a free API key, then add it to your `.env` file as `IPC_API_KEY=your_key`.

Example questions you can ask an AI assistant:

- _"What are the latest IPC acute food insecurity analyses for Ethiopia?"_
- _"How many people are in IPC Phase 3 or above in Yemen?"_
- _"Get sub-national area phase data for Somalia's most recent analysis."_
- _"Show me the population tracking trend for Afghanistan from 2020 to 2024."_
- _"What is the chronic food insecurity classification for Kenya?"_

### Available Tools

---

#### System

| Tool           | Description                                                 |
| -------------- | ----------------------------------------------------------- |
| `health_check` | Check the health status of the IPC API. No API key required |

---

#### Analyses (Public Endpoints)

These tools return simplified data with only the most recent valid period per analysis.

| Tool                     | Description                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `list_analyses`          | List all available IPC analyses with basic metadata. Filter by country (ISO2), year, and analysis type (`A`=Acute, `C`=Chronic)                  |
| `get_country_population` | Get country-level IPC population data for the latest analysis in a given year. Returns the currently valid period or most recent if all are past |
| `get_areas`              | Get sub-national area IPC population data across all analyses. Filter by country, year, and type                                                 |
| `get_points`             | Get IDP (Internally Displaced Persons) and urban area point data across all analyses                                                             |
| `get_icons`              | Get IPC phase bag and warning icons across all analyses                                                                                          |

---

#### Analysis Detail (Developer Endpoints)

These tools require an analysis ID obtained from `list_analyses`.

| Tool                         | Description                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_analysis`               | Get full metadata for a specific IPC analysis by ID, including all validity periods                                                                         |
| `get_areas_by_analysis`      | Get complete sub-national area IPC phase and population data for a specific analysis and period. Period: `C`=Current, `P`=Projection, `A`=Second Projection |
| `get_population_tracking`    | Get population tracking (PT) data across multiple analyses. **Always filter by country or year** — without filters this returns very large datasets         |
| `get_population_by_analysis` | Get detailed population tracking data for a single analysis by ID                                                                                           |
| `get_points_by_analysis`     | Get IDP and urban area point data with full population figures for a specific analysis and period                                                           |
| `get_icons_by_analysis`      | Get bag and warning icons for a specific analysis and period                                                                                                |

---

**Common parameters** across IPC-CH tools:

| Parameter | Description                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------- |
| `country` | Two-letter ISO country code (e.g. `AF`, `KE`, `SO`, `YE`, `ET`)                                       |
| `year`    | Year filter (2015–2030)                                                                               |
| `type`    | Analysis type: `A`=Acute Food Insecurity, `C`=Chronic Food Insecurity                                 |
| `id`      | Analysis ID — obtainable from `list_analyses`                                                         |
| `period`  | Analysis period: `C`=Current Situation, `P`=Projection (~3 months), `A`=Second Projection (~6 months) |
| `format`  | Response format: `json` (default), `csv`, or `geojson`                                                |

---

## ReliefWeb MCP Server

### About

This server links LLMs/Agents to the [ReliefWeb API](https://apidoc.reliefweb.int/) — OCHA's authoritative platform aggregating humanitarian information from 4,000+ trusted sources worldwide. You can ask an AI assistant questions like:

- _"What are the latest situation reports on the Sudan crisis?"_
- _"Find all OCHA reports on food security in the Sahel published in 2024."_
- _"What humanitarian jobs are open in Kenya right now?"_
- _"List upcoming humanitarian training courses available online for free."_
- _"What disaster types are covered in ReliefWeb's taxonomy?"_

**Registration:** Register a free app name at [apidoc.reliefweb.int](https://apidoc.reliefweb.int/) and add it to your `.env` file as `RELIEFWEB_APPNAME=your-app-name`.

### Available Tools

---

#### Reports

A **report** is any humanitarian document — situation report, map, analysis, press release, or feature — published on ReliefWeb. Reports are curated from 4,000+ sources including UN agencies, NGOs, governments, and research institutions.

| Tool             | Description                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `search_reports` | Search ReliefWeb reports with full-text query and filters (country, source, theme, format, language, disaster type, date range) |
| `get_report`     | Get a single report by ID — returns full body text, attached files, images, and all metadata                                    |

---

#### Disasters

A **disaster** page on ReliefWeb aggregates all content (reports, maps, updates) related to a specific disaster event. Each disaster may have a GLIDE number, multiple affected countries, and links to related documents.

| Tool               | Description                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `search_disasters` | Search disaster situations with filters (country, type, status, GLIDE number, featured flag, date range). Default sort: event date desc |
| `get_disaster`     | Get a single disaster by ID — returns full description, profile, related GLIDE numbers, and all metadata                               |

---

#### Countries

ReliefWeb maintains a profile page for each country and territory, with links to active crises, response plans, and key content.

| Tool               | Description                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `search_countries` | Search countries with filters (status, current crisis flag). Default sort: name ascending            |
| `get_country`      | Get a single country by ID — returns full profile, overview, appeals/response plans, and useful links |

---

#### Jobs

ReliefWeb hosts one of the largest humanitarian job boards — covering UN agencies, NGOs, and other organisations worldwide.

| Tool          | Description                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_jobs` | Search humanitarian job listings with filters (country, city, source, type, career category, experience level, closing date). Default sort: closing date asc    |
| `get_job`     | Get a single job listing by ID — returns full description, how-to-apply instructions, and all metadata                                                          |

---

#### Training

ReliefWeb lists humanitarian training opportunities, courses, workshops, and conferences from organisations worldwide.

| Tool               | Description                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_training`  | Search training opportunities with filters (country, city, source, type, format, language, career category, cost, date). Default sort: start date asc                        |
| `get_training`     | Get a single training by ID — returns full description, how-to-register instructions, dates, and all metadata                                                                |

---

#### Sources

**Sources** are the organisations that contribute content to ReliefWeb — UN agencies, NGOs, governments, academic institutions, and media outlets.

| Tool               | Description                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `search_sources`   | Search source organisations with filters (country, type, content type, status). Default sort: name |
| `get_source`       | Get a single source by ID — returns description, homepage, FTS ID, and all metadata                 |

---

#### Blog

The ReliefWeb blog covers updates about the platform, data projects, editorial decisions, and humanitarian information management.

| Tool           | Description                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `search_blog`  | Search ReliefWeb blog posts with filters (author, tags, date range). Default sort: created desc |
| `get_blog`     | Get a single blog post by ID — returns full body text, author, image, and all metadata          |

---

#### Book (Static Pages)

**Book** content refers to ReliefWeb's static reference pages — editorial guidelines, help documentation, location maps, and other site pages.

| Tool           | Description                                                                        |
| -------------- | ---------------------------------------------------------------------------------- |
| `search_book`  | Search book/static pages with filters (status, date range). Default sort: changed desc |
| `get_book`     | Get a single book page by ID — returns full body text and all metadata              |

---

#### Reference Taxonomies

ReliefWeb maintains controlled vocabularies (taxonomies) used to tag and classify all content — themes, disaster types, career categories, languages, and more.

| Tool                       | Description                                                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_references_directory` | Get the full taxonomy directory — lists all available vocabularies with their API field mappings. Use this to discover available taxonomy names before calling the next tool      |
| `get_reference_taxonomy`   | Get the items in a specific taxonomy. Available: `career-categories`, `content-formats`, `disaster-types`, `features`, `job-experience`, `job-types`, `languages`, `ocha-products`, `organization-types`, `themes`, `training-formats`, `training-types`, `vulnerable-groups` |

---

**Common search parameters** available across all ReliefWeb search tools:

| Parameter        | Description                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `query`          | Free-text search query (supports Lucene syntax)                                          |
| `query_operator` | `AND` (default) or `OR` — how multi-word queries are combined                            |
| `preset`         | `minimal` (default sensible filters), `latest` (sort by date), `analysis` (includes archived content) |
| `profile`        | Field set returned: `minimal` (title only), `list` (list-suitable fields), `full` (all fields) |
| `facet_fields`   | Array of fields to aggregate/facet on — results appear in `response.embedded.facets`     |
| `fields_include` | Additional fields to include alongside the profile                                       |
| `fields_exclude` | Fields to exclude from results                                                           |
| `limit`          | Results to return (0–1000, default 10)                                                   |
| `offset`         | Results to skip for pagination                                                           |
| `sort`           | Sort as `field:direction` (e.g. `date.created:desc`, `title:asc`)                        |

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

### IPC-CH Server

**`ERROR: API Key not found`**
Your `.env` file is missing or doesn't contain `IPC_API_KEY`. Register at [ipcinfo.org](https://ipcinfo.org) to get a free key and add `IPC_API_KEY=your_key` to your `.env` file.

**`API Error 401` or `403`**
Your API key is invalid or has expired. Check that you copied the full key without extra spaces, or re-generate it from your IPC account.

**`get_population_tracking` returns very large data or times out**
Always pass a `country` or `start`/`end` year filter when using this tool. Without filters it returns the entire global population tracking history, which is extremely large.

### ReliefWeb Server

**`FATAL: Cannot start server. Missing RELIEFWEB_APPNAME`**
Your `.env` file is missing or doesn't contain `RELIEFWEB_APPNAME`. Register a free app name at [apidoc.reliefweb.int](https://apidoc.reliefweb.int/) and add `RELIEFWEB_APPNAME=your-app-name` to your `.env` file.

**`API Error 422`**
A filter field value is invalid or doesn't match the taxonomy. Use `get_reference_taxonomy` (e.g. for `themes`, `disaster-types`, `career-categories`) to retrieve the exact allowed values before filtering.

**`Search returns 0 results`**
Taxonomy filter fields require exact string matches (e.g. `"Flood"` not `"flood"`, `"Administration/Finance"` not just `"Finance"`). Use `get_reference_taxonomy` to look up the correct values.

---

### All Servers

**Tools don't appear in Claude Desktop or your LLM/Agent host**

- Make sure you saved the config file and fully restarted the application (quit, don't just close the window).
- Check that the file paths in the config exactly match where you cloned this repository.
- On macOS you can verify paths by running `ls /YOUR/PATH/TO/MCPs/ifrc-mcp/server.js` in Terminal.

### Thanks for all Humanitarians for the Great work you do for the Society/Communities and for the Humanitarian Organizations that provide and publish data that facilitate Humanitarian work, Thank you.
