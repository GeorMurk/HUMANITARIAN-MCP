/**
 * KoboToolbox API MCP Server (kobo.ifrc.org)
 *
 * REQUIREMENTS:
 * 1. Create a .env file in the same folder containing: KOBO_API_TOKEN=your_token
 * 2. Optionally set KOBO_BASE_URL (default: https://kobo.ifrc.org)
 * 3. Run 'node server.js'
 */

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

const KOBO_API_TOKEN = process.env.KOBO_API_TOKEN;
const BASE_URL = process.env.KOBO_BASE_URL || "https://kobo.ifrc.org";

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
  { name: "kobo-mcp", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

async function callKoboApi(endpoint, params = {}, method = "GET", data = null) {
  if (!KOBO_API_TOKEN || KOBO_API_TOKEN === "") {
    throw new Error("ERROR: API Token not found. Please check your .env file.");
  }
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
  );
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${endpoint}`,
      params: method === "GET" ? cleanParams : undefined,
      data: method !== "GET" ? data : undefined,
      headers: {
        Authorization: `Token ${KOBO_API_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
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

      // ── ASSETS ───────────────────────────────────────────────────────────────
      {
        name: "list_assets",
        description: "List all assets (surveys, templates, collections, blocks) owned by or shared with the authenticated user. (Docs: GET /api/v2/assets/)",
        inputSchema: {
          type: "object",
          properties: {
            asset_type: { type: "string", description: "Filter by type: 'survey', 'template', 'block', 'question', 'collection'" },
            q: { type: "string", description: "Search query (name, description, etc.)" },
            ordering: { type: "string", description: "e.g. 'date_modified', '-date_modified', 'name'" },
            limit: { type: "integer", default: 100 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_asset",
        description: "Get full details for a single asset by its UID. (Docs: GET /api/v2/assets/{uid}/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID (e.g. aXXXXXXXXXXXXXXXX)" },
          },
          required: ["uid"],
        },
      },
      {
        name: "get_asset_content",
        description: "Get the raw XLSForm survey content (questions, choices, settings) for an asset. (Docs: GET /api/v2/assets/{uid}/content/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
          },
          required: ["uid"],
        },
      },
      {
        name: "get_asset_xform",
        description: "Get the XForm XML definition for a deployed survey. (Docs: GET /api/v2/assets/{uid}/xform/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
          },
          required: ["uid"],
        },
      },
      {
        name: "get_asset_xls",
        description: "Download the XLSForm (.xlsx) for a survey. Returns binary content. (Docs: GET /api/v2/assets/{uid}/xls/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
          },
          required: ["uid"],
        },
      },
      {
        name: "get_asset_counts",
        description: "Get submission and media file counts for a specific asset. (Docs: GET /api/v2/assets/{uid}/counts/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
          },
          required: ["uid"],
        },
      },
      {
        name: "get_asset_reports",
        description: "Get summary report data (frequency tables, means) for a survey's questions. (Docs: GET /api/v2/assets/{uid}/reports/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
          },
          required: ["uid"],
        },
      },
      {
        name: "list_assets_metadata",
        description: "Get a lightweight metadata list of all user assets (name, uid, type, submission count). (Docs: GET /api/v2/assets/metadata/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 100 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_assets_minimal",
        description: "Get a minimal list of all user assets (uid and name only — fastest overview). (Docs: GET /api/v2/assets/minimal-list/)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },

      // ── ASSET VERSIONS ────────────────────────────────────────────────────────
      {
        name: "list_asset_versions",
        description: "List all deployed versions of an asset/survey. (Docs: GET /api/v2/assets/{uid}/versions/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
          required: ["uid"],
        },
      },
      {
        name: "get_asset_version",
        description: "Get a specific version of an asset. (Docs: GET /api/v2/assets/{uid}/versions/{vid}/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            vid: { type: "string", description: "Version UID" },
          },
          required: ["uid", "vid"],
        },
      },

      // ── ASSET HISTORY ─────────────────────────────────────────────────────────
      {
        name: "list_asset_history",
        description: "List the audit/change history log for an asset (who changed what and when). (Docs: GET /api/v2/assets/{uid}/history/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
          required: ["uid"],
        },
      },

      // ── SUBMISSIONS (DATA) ────────────────────────────────────────────────────
      {
        name: "list_submissions",
        description: "List data submissions for a survey. Supports filtering, sorting, and field selection. (Docs: GET /api/v2/assets/{uid}/data/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            query: { type: "string", description: "MongoDB-style JSON filter, e.g. '{\"field\": \"value\"}'" },
            fields: { type: "string", description: "Comma-separated fields to return, e.g. '_id,name,age'" },
            sort: { type: "string", description: "Sort JSON, e.g. '{\"_submission_time\": -1}'" },
            start: { type: "integer", description: "Pagination offset" },
            limit: { type: "integer", default: 30 },
          },
          required: ["uid"],
        },
      },
      {
        name: "get_submission",
        description: "Get a single submission by ID. (Docs: GET /api/v2/assets/{uid}/data/{id}/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            submission_id: { type: "integer", description: "Submission ID (_id field)" },
          },
          required: ["uid", "submission_id"],
        },
      },
      {
        name: "delete_submission",
        description: "Delete a single submission. (Docs: DELETE /api/v2/assets/{uid}/data/{id}/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            submission_id: { type: "integer", description: "Submission ID" },
          },
          required: ["uid", "submission_id"],
        },
      },
      {
        name: "duplicate_submission",
        description: "Create a copy of an existing submission. (Docs: POST /api/v2/assets/{uid}/data/{id}/duplicate/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            submission_id: { type: "integer", description: "Submission ID to duplicate" },
          },
          required: ["uid", "submission_id"],
        },
      },
      {
        name: "get_submissions_count",
        description: "Get the total count of submissions for a survey without fetching the data. (Docs: GET /api/v2/assets/{uid}/data/?limit=0)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
          },
          required: ["uid"],
        },
      },
      {
        name: "bulk_delete_submissions",
        description: "Delete multiple submissions at once by providing a list of IDs. (Docs: DELETE /api/v2/assets/{uid}/data/bulk/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            submission_ids: {
              type: "array",
              items: { type: "integer" },
              description: "List of submission IDs to delete",
            },
          },
          required: ["uid", "submission_ids"],
        },
      },

      // ── VALIDATION STATUS ─────────────────────────────────────────────────────
      {
        name: "get_submission_validation_status",
        description: "Get the validation status (approved/not_approved/on_hold) of a submission. (Docs: GET /api/v2/assets/{uid}/data/{id}/validation_status/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            submission_id: { type: "integer", description: "Submission ID" },
          },
          required: ["uid", "submission_id"],
        },
      },
      {
        name: "update_submission_validation_status",
        description: "Set the validation status for a submission. Valid values: 'validation_status_approved', 'validation_status_not_approved', 'validation_status_on_hold'. (Docs: PATCH /api/v2/assets/{uid}/data/{id}/validation_status/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            submission_id: { type: "integer", description: "Submission ID" },
            status: {
              type: "string",
              enum: ["validation_status_approved", "validation_status_not_approved", "validation_status_on_hold"],
              description: "New validation status",
            },
          },
          required: ["uid", "submission_id", "status"],
        },
      },
      {
        name: "bulk_update_validation_statuses",
        description: "Update validation status for multiple submissions at once. (Docs: PATCH /api/v2/assets/{uid}/data/validation_statuses/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            submission_ids: {
              type: "array",
              items: { type: "integer" },
              description: "List of submission IDs",
            },
            status: {
              type: "string",
              enum: ["validation_status_approved", "validation_status_not_approved", "validation_status_on_hold"],
              description: "Status to apply to all listed submissions",
            },
          },
          required: ["uid", "submission_ids", "status"],
        },
      },

      // ── SUBMISSION ATTACHMENTS ────────────────────────────────────────────────
      {
        name: "list_submission_attachments",
        description: "List all file attachments (images, audio, video) submitted with a specific submission. (Docs: GET /api/v2/assets/{uid}/data/{uid_data}/attachments/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            submission_uid: { type: "string", description: "Submission UUID (_uuid field)" },
          },
          required: ["uid", "submission_uid"],
        },
      },
      {
        name: "get_submission_attachment",
        description: "Get metadata for a specific file attachment within a submission. (Docs: GET /api/v2/assets/{uid}/data/{uid_data}/attachments/{id}/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            submission_uid: { type: "string", description: "Submission UUID" },
            attachment_id: { type: "integer", description: "Attachment ID" },
          },
          required: ["uid", "submission_uid", "attachment_id"],
        },
      },
      {
        name: "delete_attachment",
        description: "Delete a specific file attachment from a submission. (Docs: DELETE /api/v2/assets/{uid}/attachments/{id}/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            attachment_id: { type: "integer", description: "Attachment ID" },
          },
          required: ["uid", "attachment_id"],
        },
      },

      // ── DEPLOYMENT ────────────────────────────────────────────────────────────
      {
        name: "get_deployment",
        description: "Get deployment status and details for a survey (is it live, how many submissions, which server). (Docs: GET /api/v2/assets/{uid}/deployment/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
          },
          required: ["uid"],
        },
      },

      // ── EXPORTS ───────────────────────────────────────────────────────────────
      {
        name: "list_asset_exports",
        description: "List all data export tasks (XLS, CSV, etc.) for a specific survey asset. (Docs: GET /api/v2/assets/{uid}/exports/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
          required: ["uid"],
        },
      },
      {
        name: "get_asset_export",
        description: "Get the status and download URL of a specific export task for a survey. (Docs: GET /api/v2/assets/{uid}/exports/{uid_export}/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            export_uid: { type: "string", description: "Export task UID" },
          },
          required: ["uid", "export_uid"],
        },
      },
      {
        name: "list_asset_export_settings",
        description: "List all saved export configurations (templates) for a survey. (Docs: GET /api/v2/assets/{uid}/export-settings/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
          },
          required: ["uid"],
        },
      },
      {
        name: "get_asset_export_setting",
        description: "Get a specific saved export configuration by its UID. (Docs: GET /api/v2/assets/{uid}/export-settings/{uid_setting}/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            setting_uid: { type: "string", description: "Export setting UID" },
          },
          required: ["uid", "setting_uid"],
        },
      },
      {
        name: "run_export_from_setting",
        description: "Trigger a new data export using a saved export setting/template. (Docs: POST /api/v2/assets/{uid}/export-settings/{uid_setting}/data/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            setting_uid: { type: "string", description: "Export setting UID" },
          },
          required: ["uid", "setting_uid"],
        },
      },

      // ── PERMISSIONS ───────────────────────────────────────────────────────────
      {
        name: "list_asset_permissions",
        description: "List all permission assignments for an asset (who has what access). (Docs: GET /api/v2/assets/{uid}/permission-assignments/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
          },
          required: ["uid"],
        },
      },
      {
        name: "list_permissions",
        description: "List all available permission types/codenames in KoBo. (Docs: GET /api/v2/permissions/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 50 },
          },
        },
      },

      // ── HOOKS / WEBHOOKS ──────────────────────────────────────────────────────
      {
        name: "list_hooks",
        description: "List all webhooks (REST services) configured for a survey. (Docs: GET /api/v2/assets/{uid}/hooks/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
          },
          required: ["uid"],
        },
      },
      {
        name: "get_hook",
        description: "Get details of a specific webhook. (Docs: GET /api/v2/assets/{uid}/hooks/{hook_uid}/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            hook_uid: { type: "string", description: "Hook UID" },
          },
          required: ["uid", "hook_uid"],
        },
      },
      {
        name: "list_hook_logs",
        description: "List delivery logs for a webhook (successes and failures). (Docs: GET /api/v2/assets/{uid}/hooks/{hook_uid}/logs/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            hook_uid: { type: "string", description: "Hook UID" },
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
          required: ["uid", "hook_uid"],
        },
      },
      {
        name: "get_hook_log",
        description: "Get details of a specific webhook delivery log entry. (Docs: GET /api/v2/assets/{uid}/hooks/{hook_uid}/logs/{log_uid}/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            hook_uid: { type: "string", description: "Hook UID" },
            log_uid: { type: "string", description: "Log entry UID" },
          },
          required: ["uid", "hook_uid", "log_uid"],
        },
      },
      {
        name: "retry_hook_log",
        description: "Retry a failed webhook delivery for a specific log entry. (Docs: POST /api/v2/assets/{uid}/hooks/{hook_uid}/logs/{log_uid}/retry/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            hook_uid: { type: "string", description: "Hook UID" },
            log_uid: { type: "string", description: "Log entry UID" },
          },
          required: ["uid", "hook_uid", "log_uid"],
        },
      },
      {
        name: "retry_hook",
        description: "Retry all failed deliveries for a webhook. (Docs: POST /api/v2/assets/{uid}/hooks/{hook_uid}/retry/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            hook_uid: { type: "string", description: "Hook UID" },
          },
          required: ["uid", "hook_uid"],
        },
      },

      // ── ASSET FILES (MEDIA) ───────────────────────────────────────────────────
      {
        name: "list_asset_files",
        description: "List all media/file attachments associated with a survey (uploaded CSV lists, background images, etc.). (Docs: GET /api/v2/assets/{uid}/files/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            file_type: { type: "string", description: "Filter by type: 'form_media', 'paired_data'" },
          },
          required: ["uid"],
        },
      },
      {
        name: "get_asset_file",
        description: "Get metadata for a specific file attached to a survey. (Docs: GET /api/v2/assets/{uid}/files/{uid_file}/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            file_uid: { type: "string", description: "File UID" },
          },
          required: ["uid", "file_uid"],
        },
      },

      // ── PAIRED DATA ───────────────────────────────────────────────────────────
      {
        name: "list_paired_data",
        description: "List paired data connections (linked datasets from other surveys) for an asset. (Docs: GET /api/v2/assets/{uid}/paired-data/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
          },
          required: ["uid"],
        },
      },
      {
        name: "get_paired_data",
        description: "Get details of a specific paired data connection. (Docs: GET /api/v2/assets/{uid}/paired-data/{uid_paired}/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
            paired_uid: { type: "string", description: "Paired data UID" },
          },
          required: ["uid", "paired_uid"],
        },
      },

      // ── ADVANCED FEATURES (NLP: TRANSCRIPTION / TRANSLATION) ─────────────────
      {
        name: "list_advanced_features",
        description: "List NLP advanced features configured for a survey (transcription, translation, qualitative analysis). (Docs: GET /api/v2/assets/{uid}/advanced-features/)",
        inputSchema: {
          type: "object",
          properties: {
            uid: { type: "string", description: "Asset UID" },
          },
          required: ["uid"],
        },
      },

      // ── IMPORTS ───────────────────────────────────────────────────────────────
      {
        name: "list_imports",
        description: "List all XLSForm import tasks for the authenticated user. (Docs: GET /api/v2/imports/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_import",
        description: "Get the status and result of a specific import task. (Docs: GET /api/v2/imports/{uid}/)",
        inputSchema: {
          type: "object",
          properties: {
            import_uid: { type: "string", description: "Import task UID" },
          },
          required: ["import_uid"],
        },
      },

      // ── ASSET SNAPSHOTS ───────────────────────────────────────────────────────
      {
        name: "list_asset_snapshots",
        description: "List all form snapshots (point-in-time copies used for Enketo previews and submission XML). (Docs: GET /api/v2/asset_snapshots/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_asset_snapshot",
        description: "Get a specific form snapshot by UID. (Docs: GET /api/v2/asset_snapshots/{uid}/)",
        inputSchema: {
          type: "object",
          properties: {
            snapshot_uid: { type: "string", description: "Snapshot UID" },
          },
          required: ["snapshot_uid"],
        },
      },

      // ── ASSET SUBSCRIPTIONS ───────────────────────────────────────────────────
      {
        name: "list_asset_subscriptions",
        description: "List all public asset subscriptions for the authenticated user. (Docs: GET /api/v2/asset_subscriptions/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── TAGS ─────────────────────────────────────────────────────────────────
      {
        name: "list_tags",
        description: "List all tags used to organize assets. (Docs: GET /api/v2/tags/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },

      // ── USERS ─────────────────────────────────────────────────────────────────
      {
        name: "list_users",
        description: "List users on the KoBo instance. (Docs: GET /api/v2/users/)",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Search by username" },
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_user",
        description: "Get a public profile for a specific user by username. (Docs: GET /api/v2/users/{username}/)",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "Username to look up" },
          },
          required: ["username"],
        },
      },

      // ── ORGANIZATIONS ─────────────────────────────────────────────────────────
      {
        name: "list_organizations",
        description: "List organizations the authenticated user belongs to. (Docs: GET /api/v2/organizations/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_organization",
        description: "Get details of a specific organization. (Docs: GET /api/v2/organizations/{uid}/)",
        inputSchema: {
          type: "object",
          properties: {
            org_uid: { type: "string", description: "Organization UID" },
          },
          required: ["org_uid"],
        },
      },
      {
        name: "list_organization_members",
        description: "List members of an organization. (Docs: GET /api/v2/organizations/{uid}/members/)",
        inputSchema: {
          type: "object",
          properties: {
            org_uid: { type: "string", description: "Organization UID" },
            limit: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
          required: ["org_uid"],
        },
      },
      {
        name: "list_organization_assets",
        description: "List all survey assets belonging to an organization. (Docs: GET /api/v2/organizations/{uid}/assets/)",
        inputSchema: {
          type: "object",
          properties: {
            org_uid: { type: "string", description: "Organization UID" },
            limit: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
          required: ["org_uid"],
        },
      },
      {
        name: "get_organization_asset_usage",
        description: "Get per-asset usage statistics (submissions, storage) for an organization. (Docs: GET /api/v2/organizations/{uid}/asset_usage/)",
        inputSchema: {
          type: "object",
          properties: {
            org_uid: { type: "string", description: "Organization UID" },
          },
          required: ["org_uid"],
        },
      },
      {
        name: "get_organization_service_usage",
        description: "Get overall service usage (submissions, storage, NLP tokens) for an organization. (Docs: GET /api/v2/organizations/{uid}/service_usage/)",
        inputSchema: {
          type: "object",
          properties: {
            org_uid: { type: "string", description: "Organization UID" },
          },
          required: ["org_uid"],
        },
      },

      // ── PROJECT VIEWS ─────────────────────────────────────────────────────────
      {
        name: "list_project_views",
        description: "List all project views (saved filtered/grouped views of assets). (Docs: GET /api/v2/project-views/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "get_project_view",
        description: "Get details of a specific project view. (Docs: GET /api/v2/project-views/{uid}/)",
        inputSchema: {
          type: "object",
          properties: {
            view_uid: { type: "string", description: "Project view UID" },
          },
          required: ["view_uid"],
        },
      },
      {
        name: "list_project_view_assets",
        description: "List all survey assets that match a project view's filters. (Docs: GET /api/v2/project-views/{uid}/assets/)",
        inputSchema: {
          type: "object",
          properties: {
            view_uid: { type: "string", description: "Project view UID" },
            limit: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
          required: ["view_uid"],
        },
      },
      {
        name: "list_project_view_users",
        description: "List users who have access to assets within a project view. (Docs: GET /api/v2/project-views/{uid}/users/)",
        inputSchema: {
          type: "object",
          properties: {
            view_uid: { type: "string", description: "Project view UID" },
          },
          required: ["view_uid"],
        },
      },

      // ── SERVICE / USAGE ───────────────────────────────────────────────────────
      {
        name: "get_service_usage",
        description: "Get overall service usage statistics (submissions, storage, NLP tokens) for the current user or org. (Docs: GET /api/v2/service_usage/)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_asset_usage",
        description: "Get per-asset usage statistics (submission counts, storage, NLP usage per survey). (Docs: GET /api/v2/asset_usage/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 50 },
            offset: { type: "integer" },
          },
        },
      },

      // ── LANGUAGES ─────────────────────────────────────────────────────────────
      {
        name: "list_languages",
        description: "List all supported languages available for form translation and NLP services. (Docs: GET /api/v2/languages/)",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 100 },
            offset: { type: "integer" },
          },
        },
      },

      // ── TRANSCRIPTION / TRANSLATION SERVICES ──────────────────────────────────
      {
        name: "list_transcription_services",
        description: "List available audio transcription service providers (e.g. Google, Microsoft). (Docs: GET /api/v2/transcription-services/)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_translation_services",
        description: "List available text translation service providers. (Docs: GET /api/v2/translation-services/)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },

      // ── AUDIT / PROJECT HISTORY LOGS ─────────────────────────────────────────
      {
        name: "list_audit_logs",
        description: "List system-wide audit logs (superuser only). (Docs: GET /api/v2/audit-logs/)",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Search/filter query" },
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },
      {
        name: "list_project_history_logs",
        description: "List project-level history logs (changes to surveys, deployments, settings). (Docs: GET /api/v2/project-history-logs/)",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Search/filter query" },
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
        },
      },

      // ── ACCESS LOGS ───────────────────────────────────────────────────────────
      {
        name: "list_my_access_logs",
        description: "List login and API access logs for the authenticated user. (Docs: GET /api/v2/access-logs/me/)",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Search/filter query" },
            limit: { type: "integer", default: 20 },
            offset: { type: "integer" },
          },
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

      // ASSETS
      case "list_assets":
        result = await callKoboApi("/api/v2/assets/", {
          asset_type: args.asset_type,
          q: args.q,
          ordering: args.ordering,
          limit: args.limit || 100,
          offset: args.offset,
        });
        break;
      case "get_asset":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/`);
        break;
      case "get_asset_content":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/content/`);
        break;
      case "get_asset_xform":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/xform/`);
        break;
      case "get_asset_xls":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/xls/`);
        break;
      case "get_asset_counts":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/counts/`);
        break;
      case "get_asset_reports":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/reports/`);
        break;
      case "list_assets_metadata":
        result = await callKoboApi("/api/v2/assets/metadata/", {
          limit: args.limit || 100,
          offset: args.offset,
        });
        break;
      case "list_assets_minimal":
        result = await callKoboApi("/api/v2/assets/minimal-list/");
        break;

      // ASSET VERSIONS
      case "list_asset_versions":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/versions/`, {
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;
      case "get_asset_version":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/versions/${args.vid}/`);
        break;

      // ASSET HISTORY
      case "list_asset_history":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/history/`, {
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;

      // SUBMISSIONS
      case "list_submissions":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/data/`, {
          query: args.query,
          fields: args.fields,
          sort: args.sort,
          start: args.start,
          limit: args.limit || 30,
        });
        break;
      case "get_submission":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/data/${args.submission_id}/`);
        break;
      case "delete_submission":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/data/${args.submission_id}/`, {}, "DELETE");
        break;
      case "duplicate_submission":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/data/${args.submission_id}/duplicate/`, {}, "POST");
        break;
      case "get_submissions_count":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/data/`, { limit: 0 });
        break;
      case "bulk_delete_submissions":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/data/bulk/`, {}, "DELETE", {
          submission_ids: args.submission_ids,
        });
        break;

      // VALIDATION STATUS
      case "get_submission_validation_status":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/data/${args.submission_id}/validation_status/`);
        break;
      case "update_submission_validation_status":
        result = await callKoboApi(
          `/api/v2/assets/${args.uid}/data/${args.submission_id}/validation_status/`,
          {}, "PATCH",
          { "validation_status.uid": args.status }
        );
        break;
      case "bulk_update_validation_statuses":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/data/validation_statuses/`, {}, "PATCH", {
          submission_ids: args.submission_ids,
          "validation_status.uid": args.status,
        });
        break;

      // SUBMISSION ATTACHMENTS
      case "list_submission_attachments":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/data/${args.submission_uid}/attachments/`);
        break;
      case "get_submission_attachment":
        result = await callKoboApi(
          `/api/v2/assets/${args.uid}/data/${args.submission_uid}/attachments/${args.attachment_id}/`
        );
        break;
      case "delete_attachment":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/attachments/${args.attachment_id}/`, {}, "DELETE");
        break;

      // DEPLOYMENT
      case "get_deployment":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/deployment/`);
        break;

      // EXPORTS
      case "list_asset_exports":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/exports/`, {
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;
      case "get_asset_export":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/exports/${args.export_uid}/`);
        break;
      case "list_asset_export_settings":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/export-settings/`);
        break;
      case "get_asset_export_setting":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/export-settings/${args.setting_uid}/`);
        break;
      case "run_export_from_setting":
        result = await callKoboApi(
          `/api/v2/assets/${args.uid}/export-settings/${args.setting_uid}/data/`,
          {}, "POST"
        );
        break;

      // PERMISSIONS
      case "list_asset_permissions":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/permission-assignments/`);
        break;
      case "list_permissions":
        result = await callKoboApi("/api/v2/permissions/", { limit: args.limit || 50 });
        break;

      // HOOKS
      case "list_hooks":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/hooks/`);
        break;
      case "get_hook":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/hooks/${args.hook_uid}/`);
        break;
      case "list_hook_logs":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/hooks/${args.hook_uid}/logs/`, {
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;
      case "get_hook_log":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/hooks/${args.hook_uid}/logs/${args.log_uid}/`);
        break;
      case "retry_hook_log":
        result = await callKoboApi(
          `/api/v2/assets/${args.uid}/hooks/${args.hook_uid}/logs/${args.log_uid}/retry/`,
          {}, "POST"
        );
        break;
      case "retry_hook":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/hooks/${args.hook_uid}/retry/`, {}, "POST");
        break;

      // ASSET FILES
      case "list_asset_files":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/files/`, { file_type: args.file_type });
        break;
      case "get_asset_file":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/files/${args.file_uid}/`);
        break;

      // PAIRED DATA
      case "list_paired_data":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/paired-data/`);
        break;
      case "get_paired_data":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/paired-data/${args.paired_uid}/`);
        break;

      // ADVANCED FEATURES
      case "list_advanced_features":
        result = await callKoboApi(`/api/v2/assets/${args.uid}/advanced-features/`);
        break;

      // IMPORTS
      case "list_imports":
        result = await callKoboApi("/api/v2/imports/", {
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;
      case "get_import":
        result = await callKoboApi(`/api/v2/imports/${args.import_uid}/`);
        break;

      // ASSET SNAPSHOTS
      case "list_asset_snapshots":
        result = await callKoboApi("/api/v2/asset_snapshots/", {
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;
      case "get_asset_snapshot":
        result = await callKoboApi(`/api/v2/asset_snapshots/${args.snapshot_uid}/`);
        break;

      // ASSET SUBSCRIPTIONS
      case "list_asset_subscriptions":
        result = await callKoboApi("/api/v2/asset_subscriptions/", {
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;

      // TAGS
      case "list_tags":
        result = await callKoboApi("/api/v2/tags/", {
          limit: args.limit || 50,
          offset: args.offset,
        });
        break;

      // USERS
      case "list_users":
        result = await callKoboApi("/api/v2/users/", {
          q: args.q,
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;
      case "get_user":
        result = await callKoboApi(`/api/v2/users/${args.username}/`);
        break;

      // ORGANIZATIONS
      case "list_organizations":
        result = await callKoboApi("/api/v2/organizations/", {
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;
      case "get_organization":
        result = await callKoboApi(`/api/v2/organizations/${args.org_uid}/`);
        break;
      case "list_organization_members":
        result = await callKoboApi(`/api/v2/organizations/${args.org_uid}/members/`, {
          limit: args.limit || 50,
          offset: args.offset,
        });
        break;
      case "list_organization_assets":
        result = await callKoboApi(`/api/v2/organizations/${args.org_uid}/assets/`, {
          limit: args.limit || 50,
          offset: args.offset,
        });
        break;
      case "get_organization_asset_usage":
        result = await callKoboApi(`/api/v2/organizations/${args.org_uid}/asset_usage/`);
        break;
      case "get_organization_service_usage":
        result = await callKoboApi(`/api/v2/organizations/${args.org_uid}/service_usage/`);
        break;

      // PROJECT VIEWS
      case "list_project_views":
        result = await callKoboApi("/api/v2/project-views/", {
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;
      case "get_project_view":
        result = await callKoboApi(`/api/v2/project-views/${args.view_uid}/`);
        break;
      case "list_project_view_assets":
        result = await callKoboApi(`/api/v2/project-views/${args.view_uid}/assets/`, {
          limit: args.limit || 50,
          offset: args.offset,
        });
        break;
      case "list_project_view_users":
        result = await callKoboApi(`/api/v2/project-views/${args.view_uid}/users/`);
        break;

      // SERVICE USAGE
      case "get_service_usage":
        result = await callKoboApi("/api/v2/service_usage/");
        break;
      case "get_asset_usage":
        result = await callKoboApi("/api/v2/asset_usage/", {
          limit: args.limit || 50,
          offset: args.offset,
        });
        break;

      // LANGUAGES
      case "list_languages":
        result = await callKoboApi("/api/v2/languages/", {
          limit: args.limit || 100,
          offset: args.offset,
        });
        break;

      // TRANSCRIPTION / TRANSLATION SERVICES
      case "list_transcription_services":
        result = await callKoboApi("/api/v2/transcription-services/");
        break;
      case "list_translation_services":
        result = await callKoboApi("/api/v2/translation-services/");
        break;

      // AUDIT / PROJECT HISTORY LOGS
      case "list_audit_logs":
        result = await callKoboApi("/api/v2/audit-logs/", {
          q: args.q,
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;
      case "list_project_history_logs":
        result = await callKoboApi("/api/v2/project-history-logs/", {
          q: args.q,
          limit: args.limit || 20,
          offset: args.offset,
        });
        break;

      // ACCESS LOGS
      case "list_my_access_logs":
        result = await callKoboApi("/api/v2/access-logs/me/", {
          q: args.q,
          limit: args.limit || 20,
          offset: args.offset,
        });
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
  if (!KOBO_API_TOKEN) {
    console.error("FATAL: Cannot start server. Missing KOBO_API_TOKEN in .env file.");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`KoBo MCP Server v2.0.0 running on stdio (Base: ${BASE_URL})`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
