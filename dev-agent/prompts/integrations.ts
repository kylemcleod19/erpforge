/**
 * ERP Forge Dev Agent — Integration Prompts
 *
 * Prompts for OAuth clients, webhook handlers, and sync logic.
 */

import type { ErpSpec, IntegrationPoint } from "../types.js";
import { buildSystemPrompt } from "./system.js";

/**
 * Builds the prompt for an integration OAuth client.
 */
export function buildIntegrationClientPrompt(
  spec: ErpSpec,
  integration: IntegrationPoint
): string {
  const slug = integration.integration_id.replace("int_", "");
  const isAuthCode = integration.auth_method === "oauth2" &&
    (integration.auth_config?.grant_type === "authorization_code" || !integration.auth_config?.grant_type);
  const isClientCreds = integration.auth_method === "oauth2" &&
    integration.auth_config?.grant_type === "client_credentials";

  return `${buildSystemPrompt(spec.spec_version)}

Generate src/lib/integrations/${slug}/client.ts

/**
 * ${integration.name} API Client
 * Implements: ${integration.integration_id}
 * Auth: ${integration.auth_method}
 * Error strategy: ${integration.error_strategy}
 */

INTEGRATION SPEC:
- Name: ${integration.name}
- Category: ${integration.category}
- Auth method: ${integration.auth_method}
- Auth config: ${JSON.stringify(integration.auth_config ?? {})}
- Max retries: ${integration.max_retries ?? 3}

ENDPOINTS:
${integration.endpoints.map((e) => `- ${e.endpoint_id} [${e.direction}] ${e.trigger}: ${e.description}${e.path ? ` (${e.method ?? "GET"} ${e.path})` : ""}`).join("\n")}

ERROR STRATEGY: ${integration.error_strategy}
${
  integration.error_strategy === "dead_letter_queue_with_alert"
    ? "- Failed requests → integration_errors Postgres table + console.error log\n- Include integration_id, endpoint_id, payload, error, timestamp"
    : integration.error_strategy === "retry_with_backoff"
    ? `- Exponential backoff: up to ${integration.max_retries ?? 3} retries\n- Delays: 1s, 2s, 4s, 8s...`
    : integration.error_strategy === "fail_fast"
    ? "- Throw immediately on any non-2xx response"
    : "- Log the error and continue (ignore_and_log)"
}

REQUIREMENTS:
1. Export a class ${integration.name.replace(/[^a-zA-Z]/g, "")}Client
2. Constructor accepts access token (fetched from oauth_tokens table by caller)
3. Private fetch wrapper that applies auth header and error strategy
4. One method per outbound endpoint in the spec
5. Use native fetch (no axios)
${isAuthCode ? "6. Tokens are stored in oauth_tokens table — client does NOT handle refresh (see oauth.ts)" : ""}
${isClientCreds ? "6. Client Credentials: fetch new token automatically when current one expires" : ""}`;
}

/**
 * Builds the prompt for OAuth flow handling.
 */
export function buildOAuthPrompt(
  spec: ErpSpec,
  integration: IntegrationPoint
): string {
  const slug = integration.integration_id.replace("int_", "");
  const authConfig = integration.auth_config ?? {};

  return `${buildSystemPrompt(spec.spec_version)}

Generate src/lib/integrations/${slug}/oauth.ts

/**
 * ${integration.name} OAuth Flow
 * Implements: ${integration.integration_id}
 * Auth: ${integration.auth_method}
 */

AUTH CONFIG:
${JSON.stringify(authConfig, null, 2)}

REQUIREMENTS:
1. getAuthorizationUrl() — returns the authorization URL to redirect user to
2. handleCallback(code, state) — exchanges code for tokens, stores in oauth_tokens table
3. getAccessToken(userId) — loads token from oauth_tokens, refreshes if expired
4. revokeToken(userId) — deletes token from oauth_tokens

oauth_tokens table schema (from better-auth + custom):
- id UUID PRIMARY KEY
- user_id UUID REFERENCES users(id)
- integration_id VARCHAR (e.g. "${integration.integration_id}")
- access_token TEXT
- refresh_token TEXT (nullable)
- expires_at TIMESTAMP
- created_at TIMESTAMP

Use openid-client for the OAuth 2.0 flow. Store tokens encrypted at rest if SECRET_KEY env is available.`;
}

/**
 * Builds the prompt for an integration sync handler.
 */
export function buildSyncPrompt(
  spec: ErpSpec,
  integration: IntegrationPoint
): string {
  const slug = integration.integration_id.replace("int_", "");
  const outboundEndpoints = integration.endpoints.filter(
    (e) => e.direction === "outbound" || e.direction === "bidirectional"
  );

  return `${buildSystemPrompt(spec.spec_version)}

Generate src/lib/integrations/${slug}/sync.ts

/**
 * ${integration.name} Sync Handlers
 * Implements: ${integration.integration_id}
 * Outbound sync logic — called from Route Handlers after ERP state changes
 */

OUTBOUND ENDPOINTS:
${outboundEndpoints.map((e) => `- ${e.endpoint_id}: triggered by "${e.trigger}" — ${e.description}`).join("\n")}

REQUIREMENTS:
1. One exported async function per outbound endpoint: sync${outboundEndpoints.map((e) => e.endpoint_id.replace(/^ep_/, "")).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", sync")}
2. Each function: loads OAuth token via oauth.ts, instantiates client, calls client method
3. Handles error strategy: ${integration.error_strategy}
4. Include JSDoc explaining WHEN each sync function should be called (the trigger)
5. These are called from service layer — not directly from Route Handlers`;
}
