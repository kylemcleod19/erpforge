/**
 * ERP Forge Dev Agent — Plan Generator
 *
 * Reads a validated ErpSpec and produces a structured build plan showing
 * what will be generated in each phase, along with pre-build spec flags.
 * The operator must approve the plan before generation begins.
 */

import type {
  ErpSpec,
  BuildPlan,
  BuildPlanPhase,
  BuildPlanItem,
  PreBuildFlag,
  DataEntity,
  FeatureRequirement,
  IntegrationPoint,
  AiTouchpoint,
  CoreWorkflow,
} from "./types.js";

// ─── Pre-Build Flag Analysis ──────────────────────────────────────────────────

/**
 * Analyzes the spec for issues that should be resolved before building.
 * Returns a list of pre-build flags ordered by criticality.
 */
export function analyzePreBuildFlags(spec: ErpSpec): PreBuildFlag[] {
  const flags: PreBuildFlag[] = [];
  let n = 1;

  // Flag 1: Missing auth/login feature
  const hasAuthFeature = spec.feature_requirements.some(
    (f) =>
      f.type === "screen" &&
      (f.name.toLowerCase().includes("login") ||
        f.name.toLowerCase().includes("auth") ||
        f.name.toLowerCase().includes("sign in") ||
        f.description.toLowerCase().includes("login"))
  );
  const hasUserEntity = spec.data_entities.some(
    (e) =>
      e.entity_id === "ent_user" ||
      e.name.toLowerCase().includes("user") ||
      e.name.toLowerCase().includes("staff")
  );

  if (!hasAuthFeature) {
    flags.push({
      number: n++,
      section: "feature_requirements",
      issue:
        "No auth/login screen defined — every ERP needs RBAC login but it's missing from the spec.",
      proposed_default:
        'Add feat_login (type: screen, P1, roles: all) and ent_user to data_entities. Amend spec. This adds better-auth session management and login/logout flows.',
      requires_operator_decision: true,
    });
  }

  if (!hasUserEntity) {
    flags.push({
      number: n++,
      section: "data_entities",
      issue:
        `${spec.development_standards.roles.length} roles are defined but no ent_user entity exists to store users.`,
      proposed_default:
        "Add ent_user (id UUID, email VARCHAR, name VARCHAR, role ENUM, created_at TIMESTAMP). Required for better-auth to function.",
      requires_operator_decision: false,
    });
  }

  // Flag: RAG context window strategy
  const ragTouchpoints = spec.ai_touchpoints.filter(
    (tp) =>
      tp.input_context.context_window_strategy === "rag_from_part_catalog"
  );
  if (ragTouchpoints.length > 0) {
    flags.push({
      number: n++,
      section: `ai_touchpoints.${ragTouchpoints.map((t) => t.touchpoint_id).join(", ")}`,
      issue: `context_window_strategy "rag_from_part_catalog" implies a vector database (pgvector or external). This is significant infrastructure not elsewhere in the spec.`,
      proposed_default:
        'Downgrade to "entity_snapshot" (no vector DB required). The full entity list is passed as context instead. Operator must confirm or explicitly accept vector search scope.',
      requires_operator_decision: true,
    });
  }

  // Flag: Missing OAuth callback URL
  const oauth2Integrations = spec.integration_points.filter(
    (i) => i.auth_method === "oauth2"
  );
  for (const int of oauth2Integrations) {
    if (!int.auth_config?.callback_url) {
      flags.push({
        number: n++,
        section: `integration_points.${int.integration_id}`,
        issue: `OAuth2 integration "${int.name}" requires a known HTTPS callback URL but none is set in auth_config.`,
        proposed_default: `Add callback_url to ${int.integration_id}.auth_config. Set to your Railway app URL before OAuth testing (e.g. https://<app>.railway.app/api/auth/callback/${int.integration_id.replace("int_", "")}).`,
        requires_operator_decision: false,
      });
    }
  }

  // Flag: ORM preference TBD
  if (
    !spec.development_standards.orm_preference ||
    spec.development_standards.orm_preference.toLowerCase() === "tbd"
  ) {
    flags.push({
      number: n++,
      section: "development_standards.orm_preference",
      issue: 'orm_preference is "tbd" — must be set before Drizzle schema generation.',
      proposed_default: 'Set to "drizzle". Amend spec. Drizzle ORM is TypeScript-first and maps cleanly to spec data_entities.',
      requires_operator_decision: false,
    });
  }

  // Flag: Background jobs with no infrastructure
  const bgJobFeatures = spec.feature_requirements.filter(
    (f) => f.type === "background_job"
  );
  if (bgJobFeatures.length > 0 && !spec.integration_points.some((i) => i.category === "other" && i.name.toLowerCase().includes("queue"))) {
    flags.push({
      number: n++,
      section: `feature_requirements.${bgJobFeatures.map((f) => f.feature_id).join(", ")}`,
      issue: `${bgJobFeatures.length} background job feature(s) defined but no job queue infrastructure is in the spec.`,
      proposed_default:
        "Default: use node-cron (in-process scheduler) triggered from the relevant Route Handler. No separate worker process. Operator must confirm or accept this scope.",
      requires_operator_decision: true,
    });
  }

  // Flag: Workflow actor system_id referencing non-integration
  for (const wf of spec.core_workflows) {
    for (const step of wf.steps) {
      if (step.actor.type === "system" && step.actor.system_id) {
        const isKnownIntegration = spec.integration_points.some(
          (i) => i.integration_id === step.actor.system_id
        );
        const isKnownSystem = [
          "erp_system",
          "platform",
          "api",
          "scheduler",
        ].includes(step.actor.system_id ?? "");
        if (!isKnownIntegration && !isKnownSystem) {
          flags.push({
            number: n++,
            section: `core_workflows.${step.step_id}`,
            issue: `Step "${step.name}" has actor.system_id "${step.actor.system_id}" which doesn't reference any known integration_point.`,
            proposed_default: `Change actor.type to "human" with appropriate role, or add "${step.actor.system_id}" as an integration_point. Amend spec.`,
            requires_operator_decision: false,
          });
        }
      }
    }
  }

  return flags;
}

// ─── Phase Plan Builders ──────────────────────────────────────────────────────

function buildScaffoldPhase(spec: ErpSpec): BuildPlanPhase {
  return {
    phase_number: 1,
    name: "Scaffold",
    description: "Next.js 15 App Router project structure, Railway config, environment template",
    items: [
      {
        id: "scaffold_nextjs",
        description: "package.json, next.config.ts, tsconfig.json, tailwind.config.ts, drizzle.config.ts",
        spec_refs: ["development_standards"],
      },
      {
        id: "scaffold_railway",
        description: "railway.toml (startCommand: node scripts/migrate && next start), .env.example with all required variables",
        spec_refs: ["development_standards"],
      },
      {
        id: "scaffold_auth",
        description: `better-auth setup with ${spec.development_standards.roles.length} role(s): ${spec.development_standards.roles.map((r) => r.role_id).join(", ")}`,
        spec_refs: ["development_standards.roles"],
      },
      {
        id: "scaffold_lib",
        description: "lib/api/handler.ts (withAuth), lib/api/response.ts (ok/apiError), lib/api/pagination.ts, lib/api/errors.ts",
        spec_refs: ["development_standards"],
      },
    ],
  };
}

function buildDatabasePhase(spec: ErpSpec): BuildPlanPhase {
  const items: BuildPlanItem[] = spec.data_entities.map((entity: DataEntity) => ({
    id: entity.entity_id,
    description: [
      `${entity.name} — ${entity.fields.length} fields`,
      entity.soft_delete ? "soft delete" : null,
      entity.audit_trail ? "audit trail (createdAt/updatedAt)" : null,
      entity.relationships?.length
        ? `${entity.relationships.length} relationship(s)`
        : null,
    ]
      .filter(Boolean)
      .join(", "),
    spec_refs: [entity.entity_id],
    notes: entity.notes ?? undefined,
  }));

  items.push({
    id: "db_migration",
    description: `Initial migration: 0001_initial_schema.sql + 0001_initial_schema.down.sql (rollback DDL)`,
    spec_refs: spec.data_entities.map((e) => e.entity_id),
  });

  return {
    phase_number: 2,
    name: "Database Schema",
    description: `${spec.data_entities.length} Drizzle tables → PostgreSQL. Rule-based generation (no AI cost).`,
    items,
  };
}

function buildApiPhase(spec: ErpSpec): BuildPlanPhase {
  const items: BuildPlanItem[] = [];

  // CRUD routes per entity
  for (const entity of spec.data_entities) {
    const resource = entity.entity_id.replace(/^ent_/, "").replace(/_/g, "-");
    items.push({
      id: `api_${entity.entity_id}`,
      description: `GET /api/v1/${resource} (cursor list), GET /${resource}/:id, POST, PATCH, DELETE + service layer`,
      spec_refs: [entity.entity_id],
    });
  }

  // Action routes from workflows
  for (const wf of spec.core_workflows) {
    for (const step of wf.steps) {
      if (step.action && step.action !== "view" && step.action !== "read" && step.outputs?.length) {
        const outputRef = step.outputs[0]?.entity_ref;
        if (outputRef) {
          const resource = outputRef.replace(/^ent_/, "").replace(/_/g, "-");
          const action = step.action.replace(/_/g, "-");
          items.push({
            id: `api_action_${step.step_id}`,
            description: `POST /api/v1/${resource}/:id/${action} — ${step.name}`,
            spec_refs: [step.step_id, wf.workflow_id],
          });
        }
      }
    }
  }

  // AI touchpoint routes
  for (const tp of spec.ai_touchpoints) {
    const slug = tp.touchpoint_id.replace(/^ai_/, "ai-");
    items.push({
      id: `api_ai_${tp.touchpoint_id}`,
      description: `POST /api/v1/ai/${slug} — ${tp.name} (${tp.model_preference})`,
      spec_refs: [tp.touchpoint_id],
    });
  }

  // Webhook routes
  for (const int of spec.integration_points) {
    const inboundEndpoints = int.endpoints.filter(
      (e) => e.direction === "inbound" || e.direction === "bidirectional"
    );
    if (inboundEndpoints.length > 0) {
      items.push({
        id: `api_webhook_${int.integration_id}`,
        description: `POST /api/v1/webhooks/${int.integration_id.replace("int_", "")} — ${int.name} inbound (HMAC verified)`,
        spec_refs: [int.integration_id],
      });
    }
  }

  items.push({
    id: "api_openapi",
    description: "openapi.yaml — generated from Route Handler types (satisfies documentation_rules)",
    spec_refs: ["development_standards.documentation_rules"],
  });

  return {
    phase_number: 3,
    name: "Backend API",
    description: `${spec.data_entities.length} entity CRUD routes + action routes + AI routes + webhooks. AI-assisted generation.`,
    items,
  };
}

function buildFrontendPhase(spec: ErpSpec): BuildPlanPhase {
  const items: BuildPlanItem[] = [
    {
      id: "ui_auth",
      description: "app/(auth)/login/page.tsx — login form with better-auth",
      spec_refs: ["development_standards.roles"],
    },
    {
      id: "ui_layout",
      description: "app/(app)/layout.tsx — authenticated shell with sidebar, role guard",
      spec_refs: ["development_standards.roles"],
    },
  ];

  // P1 screens first
  const p1Features = spec.feature_requirements.filter(
    (f) => f.priority === "P1" && (f.type === "screen" || f.type === "dashboard_widget")
  );
  const p2Features = spec.feature_requirements.filter(
    (f) => f.priority === "P2" && (f.type === "screen" || f.type === "dashboard_widget")
  );

  for (const feat of [...p1Features, ...p2Features]) {
    const route = feat.name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, "-");
    items.push({
      id: `ui_${feat.feature_id}`,
      description: `[${feat.priority}] ${feat.name} — ${feat.type === "screen" ? `${feat.ui_notes?.layout ?? "list"} view, roles: ${feat.user_roles.join(", ")}` : "dashboard widget"}`,
      spec_refs: [feat.feature_id, ...feat.user_roles],
      notes: feat.acceptance_criteria.length
        ? `${feat.acceptance_criteria.length} acceptance criteria`
        : undefined,
    });
    void route; // suppress unused warning
  }

  return {
    phase_number: 4,
    name: "Frontend Screens",
    description: `${p1Features.length} P1 screens + ${p2Features.length} P2 screens. RSC for list/detail, Client Components for forms. AI-assisted generation.`,
    items,
  };
}

function buildIntegrationsPhase(spec: ErpSpec): BuildPlanPhase {
  const items: BuildPlanItem[] = spec.integration_points.map(
    (int: IntegrationPoint) => ({
      id: int.integration_id,
      description: [
        `${int.name} (${int.category})`,
        `auth: ${int.auth_method}`,
        `${int.endpoints.length} endpoint(s)`,
        `error strategy: ${int.error_strategy}`,
      ].join(" | "),
      spec_refs: [int.integration_id],
    })
  );

  return {
    phase_number: 5,
    name: "Integrations",
    description: `${spec.integration_points.length} integration(s). OAuth clients, webhook handlers, sync logic. AI-assisted generation.`,
    items,
  };
}

function buildAiTouchpointsPhase(spec: ErpSpec): BuildPlanPhase {
  const items: BuildPlanItem[] = spec.ai_touchpoints.map(
    (tp: AiTouchpoint) => ({
      id: tp.touchpoint_id,
      description: [
        tp.name,
        `model: ${tp.model_preference}`,
        `agent_type: ${tp.agent_type}`,
        tp.confidence_threshold != null
          ? `confidence: ${tp.confidence_threshold}`
          : null,
        tp.human_in_the_loop.required ? "human-in-the-loop required" : null,
      ]
        .filter(Boolean)
        .join(" | "),
      spec_refs: [tp.touchpoint_id],
    })
  );

  return {
    phase_number: 6,
    name: "AI Touchpoints",
    description: `${spec.ai_touchpoints.length} AI touchpoint(s). Prompt builders, Anthropic SDK calls, confidence checks. AI-assisted generation.`,
    items,
  };
}

function buildDocsPhase(_spec: ErpSpec): BuildPlanPhase {
  return {
    phase_number: 7,
    name: "Documentation",
    description: "Handoff docs, customer summary, final spec and build manifest.",
    items: [
      {
        id: "docs_handoff",
        description:
          "docs/HANDOFF.md — architecture, env vars, run locally, deploy to Railway, add entity/integration/touchpoint guide, spec version history",
        spec_refs: [],
      },
      {
        id: "docs_customer",
        description:
          "docs/CUSTOMER_SUMMARY.md — plain language: what was built, pain points addressed, how integrations work, where AI assists",
        spec_refs: [],
      },
      {
        id: "docs_manifest",
        description:
          "build-manifest.json — final spec ID → file path mapping",
        spec_refs: [],
      },
    ],
  };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Generates a complete build plan from the spec.
 * Does not modify any files — only reads the spec and returns the plan.
 */
export function generateBuildPlan(
  spec: ErpSpec,
  customerSlug: string
): BuildPlan {
  const phases = [
    buildScaffoldPhase(spec),
    buildDatabasePhase(spec),
    buildApiPhase(spec),
    buildFrontendPhase(spec),
    buildIntegrationsPhase(spec),
    buildAiTouchpointsPhase(spec),
    buildDocsPhase(spec),
  ];

  const preFlags = analyzePreBuildFlags(spec);

  return {
    customer_slug: customerSlug,
    spec_version: spec.spec_version,
    generated_at: new Date().toISOString(),
    phases,
    pre_build_flags: preFlags,
    approved: false,
  };
}

// ─── Display Helpers ──────────────────────────────────────────────────────────

const LINE = "═".repeat(70);
const LINE2 = "─".repeat(70);

/**
 * Renders the build plan to the console for operator review.
 */
export function printBuildPlan(plan: BuildPlan): void {
  console.log(`\n${LINE}`);
  console.log(`  ERP FORGE — DEVELOPMENT PLAN`);
  console.log(`  Customer: ${plan.customer_slug}  |  Spec v${plan.spec_version}`);
  console.log(LINE);

  // Pre-build flags
  if (plan.pre_build_flags.length > 0) {
    const blockers = plan.pre_build_flags.filter(
      (f) => f.requires_operator_decision
    );
    const notes = plan.pre_build_flags.filter(
      (f) => !f.requires_operator_decision
    );

    if (blockers.length > 0) {
      console.log(`\n  ⚠  PRE-BUILD FLAGS — OPERATOR DECISION REQUIRED\n`);
      for (const flag of blockers) {
        console.log(`  [${flag.number}] ${flag.section}`);
        console.log(`      Issue: ${flag.issue}`);
        console.log(`      Default: ${flag.proposed_default}`);
        console.log();
      }
    }

    if (notes.length > 0) {
      console.log(`  ℹ  PRE-BUILD NOTES (will apply defaults automatically)\n`);
      for (const flag of notes) {
        console.log(`  [${flag.number}] ${flag.section}`);
        console.log(`      ${flag.proposed_default}`);
        console.log();
      }
    }

    console.log(LINE2);
  }

  // Phase summaries
  console.log(`\n  BUILD PHASES\n`);
  for (const phase of plan.phases) {
    console.log(
      `  Phase ${phase.phase_number}: ${phase.name}  (${phase.items.length} items)`
    );
    console.log(`  ${phase.description}`);
    for (const item of phase.items) {
      console.log(`    • ${item.description}`);
    }
    console.log();
  }

  console.log(LINE);
  console.log();
}
