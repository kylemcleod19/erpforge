/**
 * ERP Forge Dev Agent — API Prompts
 *
 * Prompts for Route Handler and service layer generation.
 */

import type {
  ErpSpec,
  DataEntity,
  FeatureRequirement,
  CoreWorkflow,
  WorkflowStep,
} from "../types.js";
import { entityToContext } from "./database.js";
import { buildSystemPrompt } from "./system.js";

/**
 * Builds the prompt for generating CRUD Route Handlers for an entity.
 */
export function buildRouteHandlerPrompt(
  spec: ErpSpec,
  entity: DataEntity
): string {
  const resource = entity.entity_id.replace(/^ent_/, "").replace(/_/g, "-");
  const features = spec.feature_requirements.filter((f) =>
    f.acceptance_criteria.some((ac) =>
      ac.toLowerCase().includes(entity.name.toLowerCase())
    )
  );

  return `${buildSystemPrompt(spec.spec_version)}

Generate src/app/api/v1/${resource}/route.ts for the following entity.

/**
 * ${entity.name} Route Handlers
 * Implements: ${entity.entity_id}${features.length ? ", " + features.map((f) => f.feature_id).join(", ") : ""}
 * Endpoints: GET /api/v1/${resource} — POST /api/v1/${resource}
 */

ENTITY SPEC:
${entityToContext(entity)}

RELATED FEATURES:
${features.length ? features.map((f) => `- ${f.feature_id}: ${f.name}\n  ${f.acceptance_criteria.join("\n  ")}`).join("\n") : "None"}

ROLES WITH ACCESS:
${spec.development_standards.roles.map((r) => `- ${r.role_id}: ${r.permissions.join(", ")}`).join("\n")}

REQUIREMENTS:
1. GET handler: cursor-paginated list, optional ?search= param, calls service.list()
2. POST handler: Zod validation, calls service.create(), returns 201 with created entity
3. Both handlers use withAuth() from lib/api/handler.ts
4. Both call ok() or apiError() from lib/api/response.ts
5. Import the service from services/${entity.entity_id.replace("ent_", "")}.service.ts
6. Cursor pagination: use encodeCursor/decodeCursor from lib/api/pagination.ts

Also generate src/app/api/v1/${resource}/[id]/route.ts with GET one, PATCH, DELETE handlers.`;
}

/**
 * Builds the prompt for a service file.
 */
export function buildServicePrompt(
  spec: ErpSpec,
  entity: DataEntity
): string {
  const relatedWorkflows = spec.core_workflows.filter((wf) =>
    wf.steps.some(
      (s) =>
        s.inputs?.some((i) => i.entity_ref === entity.entity_id) ||
        s.outputs?.some((o) => o.entity_ref === entity.entity_id)
    )
  );

  return `${buildSystemPrompt(spec.spec_version)}

Generate src/services/${entity.entity_id.replace("ent_", "")}.service.ts

/**
 * ${entity.name} Service
 * Implements: ${entity.entity_id}${relatedWorkflows.length ? ", " + relatedWorkflows.map((w) => w.workflow_id).join(", ") : ""}
 * Business logic layer between Route Handlers and Drizzle
 */

ENTITY SPEC:
${entityToContext(entity)}

RELATED WORKFLOWS:
${
  relatedWorkflows.length
    ? relatedWorkflows
        .map(
          (wf) =>
            `${wf.workflow_id}: ${wf.name}\n${wf.steps
              .filter(
                (s) =>
                  s.inputs?.some((i) => i.entity_ref === entity.entity_id) ||
                  s.outputs?.some((o) => o.entity_ref === entity.entity_id)
              )
              .map((s) => `  Step ${s.step_id}: ${s.name} — ${s.action}`)
              .join("\n")}`
        )
        .join("\n\n")
    : "None"
}

BUSINESS RULES:
${
  relatedWorkflows
    .flatMap((wf) =>
      wf.steps
        .filter(
          (s) =>
            s.inputs?.some((i) => i.entity_ref === entity.entity_id) ||
            s.outputs?.some((o) => o.entity_ref === entity.entity_id)
        )
        .flatMap((s) => s.rules ?? [])
    )
    .map((r) => `- [${r.type}] ${r.description}`)
    .join("\n") || "None defined in spec"
}

REQUIREMENTS:
1. Export: list(opts), findById(id), create(data), update(id, data), remove(id)
2. list() returns { items, nextCursor } using cursor pagination
3. ${entity.soft_delete ? "remove() sets deletedAt (soft delete), does not DELETE the row" : "remove() hard-deletes the row"}
4. ${entity.audit_trail ? "create() and update() manage createdAt and updatedAt automatically" : "No audit trail required"}
5. Throw NotFoundError from lib/api/errors.ts when entity not found
6. Include WHY comments explaining business rules from the spec`;
}

/**
 * Builds the prompt for an action route (workflow step).
 */
export function buildActionRoutePrompt(
  spec: ErpSpec,
  workflow: CoreWorkflow,
  step: WorkflowStep
): string {
  const outputEntity = step.outputs?.[0]?.entity_ref;
  if (!outputEntity) return "";

  const resource = outputEntity.replace(/^ent_/, "").replace(/_/g, "-");
  const action = step.action.replace(/_/g, "-");

  const rules =
    step.rules
      ?.map((r) => `- [${r.type}] ${r.description}`)
      .join("\n") ?? "None";

  return `${buildSystemPrompt(spec.spec_version)}

Generate src/app/api/v1/${resource}/[id]/${action}/route.ts

/**
 * ${step.name} — Action Route Handler
 * Implements: ${step.step_id}, ${workflow.workflow_id}
 * Endpoint: POST /api/v1/${resource}/:id/${action}
 */

WORKFLOW STEP:
- Step: ${step.step_id} (sequence ${step.sequence})
- Name: ${step.name}
- Actor: ${JSON.stringify(step.actor)}
- Action: ${step.action}
- Inputs: ${JSON.stringify(step.inputs)}
- Outputs: ${JSON.stringify(step.outputs)}

BUSINESS RULES:
${rules}

REQUIREMENTS:
1. POST handler only (action routes are write operations)
2. withAuth() wrapping with role check for actor: ${step.actor.role ?? "any authenticated user"}
3. Validate that entity exists and is in correct state for this action
4. Apply business rules in comments explaining WHY each check exists
5. Return the updated entity in ok() envelope
6. Call the service layer — do not inline Drizzle queries`;
}

/**
 * Builds the prompt for a webhook handler Route.
 */
export function buildWebhookRoutePrompt(
  spec: ErpSpec,
  integrationId: string
): string {
  const integration = spec.integration_points.find(
    (i) => i.integration_id === integrationId
  );
  if (!integration) return "";

  const inboundEndpoints = integration.endpoints.filter(
    (e) => e.direction === "inbound" || e.direction === "bidirectional"
  );

  return `${buildSystemPrompt(spec.spec_version)}

Generate src/app/api/v1/webhooks/${integrationId.replace("int_", "")}/route.ts

/**
 * ${integration.name} Webhook Handler
 * Implements: ${integrationId}
 * Endpoint: POST /api/v1/webhooks/${integrationId.replace("int_", "")}
 */

INTEGRATION:
- Name: ${integration.name}
- Category: ${integration.category}
- Auth method: ${integration.auth_method}
- Auth config keys: ${Object.keys(integration.auth_config ?? {}).join(", ") || "none"}

INBOUND ENDPOINTS:
${inboundEndpoints.map((e) => `- ${e.endpoint_id}: ${e.trigger} — ${e.description}`).join("\n")}

REQUIREMENTS:
1. Verify HMAC signature (use auth_config.webhook_secret from env)
2. Parse and validate the incoming payload with Zod
3. Route to event handlers based on event type
4. Return 200 immediately (acknowledge before processing)
5. Log unrecognized event types, don't throw
6. Error strategy: ${integration.error_strategy}`;
}
