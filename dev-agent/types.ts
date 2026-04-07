/**
 * ERP Forge Dev Agent — Core Types
 *
 * Types for the development agent that reads a completed customer spec
 * and generates a full Next.js 15 App Router ERP platform.
 */

// ─── Spec Document ────────────────────────────────────────────────────────────

/** Top-level ERP Forge spec document (matches spec.schema.json) */
export interface ErpSpec {
  $schema?: string;
  schema_version: string;
  spec_version: string;
  spec_id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  business_profile: BusinessProfile;
  core_workflows: CoreWorkflow[];
  data_entities: DataEntity[];
  feature_requirements: FeatureRequirement[];
  integration_points: IntegrationPoint[];
  ai_touchpoints: AiTouchpoint[];
  development_standards: DevelopmentStandards;
  history: HistoryEntry[];
}

export interface BusinessProfile {
  company_name: string;
  industry: string;
  industry_display?: string;
  company_size: {
    employees: number;
    annual_revenue_band: string;
    manufacturing_sites?: number;
  };
  revenue_model: string[];
  revenue_model_description?: string;
  pain_points: Array<{ id: string; description: string; severity: string }>;
  success_metrics: Array<{ id: string; description: string }>;
}

export interface WorkflowStep {
  step_id: string;
  sequence: number;
  name: string;
  actor: { type: string; role?: string; system_id?: string; name?: string };
  action: string;
  system: string;
  inputs?: Array<{ entity_ref: string; state?: string; source?: string }>;
  outputs?: Array<{ entity_ref: string; state?: string }>;
  rules?: Array<{ rule_id: string; type: string; description: string }>;
  notes?: string | null;
}

export interface CoreWorkflow {
  workflow_id: string;
  name: string;
  description: string;
  priority: "P1" | "P2";
  steps: WorkflowStep[];
}

export interface FieldDescriptor {
  field_id: string;
  name: string;
  type:
    | "uuid"
    | "string"
    | "text"
    | "integer"
    | "decimal"
    | "boolean"
    | "datetime"
    | "enum"
    | "json_blob"
    | "file_ref";
  required: boolean;
  enum_values?: string[];
  notes?: string | null;
}

export interface RelationshipDescriptor {
  type: "belongs_to" | "has_many" | "many_to_many";
  entity: string;
  foreign_key?: string;
  cascade?: "delete" | "restrict" | "set_null";
  join_table?: string;
}

export interface DataEntity {
  entity_id: string;
  name: string;
  description: string;
  fields: FieldDescriptor[];
  relationships?: RelationshipDescriptor[];
  soft_delete?: boolean;
  audit_trail?: boolean;
  notes?: string | null;
}

export interface UINote {
  layout?:
    | "list"
    | "detail"
    | "form"
    | "dashboard"
    | "kanban"
    | "calendar"
    | "wizard";
  primary_action?: string;
  display_fields?: string[];
  notes?: string;
}

export interface FeatureRequirement {
  feature_id: string;
  name: string;
  description: string;
  type:
    | "screen"
    | "workflow"
    | "integration"
    | "background_job"
    | "report"
    | "api_endpoint"
    | "dashboard_widget";
  priority: "P1" | "P2";
  user_roles: string[];
  acceptance_criteria: string[];
  ui_notes?: UINote | null;
}

export interface IntegrationEndpoint {
  endpoint_id: string;
  direction: "outbound" | "inbound" | "bidirectional";
  trigger: string;
  description: string;
  path?: string;
  method?: string;
}

export interface IntegrationPoint {
  integration_id: string;
  name: string;
  category:
    | "accounting"
    | "shipping"
    | "crm"
    | "marketplace"
    | "payment"
    | "communication"
    | "other";
  auth_method: "oauth2" | "api_key" | "basic_auth" | "webhook_secret" | "none";
  auth_config?: Record<string, string>;
  endpoints: IntegrationEndpoint[];
  error_strategy:
    | "retry_with_backoff"
    | "dead_letter_queue_with_alert"
    | "fail_fast"
    | "ignore_and_log";
  max_retries?: number;
}

export interface AiTouchpoint {
  touchpoint_id: string;
  name: string;
  description: string;
  trigger: string;
  agent_type: "classifier" | "extractor" | "advisor" | "reconciler" | "other";
  model_preference: "claude-haiku" | "claude-sonnet" | "claude-opus";
  input_context: {
    provided_to_agent: string[];
    context_window_strategy:
      | "full_entity_snapshot"
      | "entity_snapshot"
      | "rag_from_part_catalog"
      | "recent_history"
      | "custom";
  };
  expected_output: {
    format: "json" | "text" | "structured_list";
    fields?: string[];
    example?: string;
  };
  confidence_threshold?: number;
  fallback_strategy?: string;
  human_in_the_loop: {
    required: boolean;
    condition?: string;
    review_ui?: string;
  };
}

export interface RoleDefinition {
  role_id: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface DevelopmentStandards {
  api_style: string;
  auth_mechanism: string;
  architecture_pattern: string;
  database_type: string;
  orm_preference: string;
  api_versioning_strategy: string;
  api_base_path: string;
  test_coverage_threshold: number;
  roles: RoleDefinition[];
  documentation_rules?: {
    require_openapi_for_all_endpoints?: boolean;
    require_jsdoc_on_exported_functions?: boolean;
    comment_style?: string;
  };
}

export interface HistoryEntry {
  version: string;
  changed_at: string;
  changed_by: string;
  change_type:
    | "initial_creation"
    | "amendment"
    | "correction"
    | "section_added"
    | "re_scope";
  rationale: string;
  amended_sections?: string[];
}

// ─── Generator Context ────────────────────────────────────────────────────────

/** Shared context passed to every generator */
export interface GeneratorContext {
  /** The validated customer spec */
  spec: ErpSpec;
  /** Kebab-case slug: customers/<slug>/platform/ */
  customerSlug: string;
  /** Absolute path to the output platform directory */
  platformDir: string;
  /** Anthropic API key for AI-assisted generators */
  apiKey: string;
  /** Accumulated spec amendments during generation */
  pendingAmendments: SpecAmendment[];
}

// ─── Generated Files ──────────────────────────────────────────────────────────

export interface GeneratedFile {
  /** Relative path from platformDir, e.g. "src/db/schema/customers.ts" */
  relativePath: string;
  /** File contents */
  content: string;
  /** Spec IDs this file implements */
  specIds: string[];
  /** Which generator produced this */
  generator: string;
}

// ─── Spec Amendments ──────────────────────────────────────────────────────────

export type VersionBumpType = "major" | "minor" | "patch";

export interface SpecAmendment {
  /** ISO timestamp when the amendment was flagged */
  flagged_at: string;
  /** Which spec section was flagged */
  section: string;
  /** Description of the issue */
  issue: string;
  /** Proposed resolution */
  proposed_resolution: string;
  /** Operator-approved resolution (may differ from proposal) */
  approved_resolution: string;
  /** Type of version bump to apply */
  bump_type: VersionBumpType;
  /** Operator note (optional) */
  operator_note?: string;
}

// ─── Build Plan ───────────────────────────────────────────────────────────────

export interface BuildPlanPhase {
  phase_number: number;
  name: string;
  description: string;
  items: BuildPlanItem[];
}

export interface BuildPlanItem {
  id: string;
  description: string;
  spec_refs: string[];
  notes?: string;
}

export interface PreBuildFlag {
  /** Sequential number */
  number: number;
  /** Spec section affected */
  section: string;
  /** Issue description */
  issue: string;
  /** Proposed default resolution */
  proposed_default: string;
  /** Whether operator must resolve before build can proceed */
  requires_operator_decision: boolean;
  /** Resolution chosen by operator */
  operator_resolution?: string;
}

export interface BuildPlan {
  customer_slug: string;
  spec_version: string;
  generated_at: string;
  phases: BuildPlanPhase[];
  pre_build_flags: PreBuildFlag[];
  /** true when operator has approved the plan */
  approved: boolean;
  approved_at?: string;
}

// ─── Build Manifest ───────────────────────────────────────────────────────────

export interface ManifestEntry {
  /** Spec ID (entity_id, feature_id, integration_id, etc.) */
  spec_id: string;
  /** Spec section name */
  spec_section: string;
  /** Relative paths of generated files for this spec node */
  generated_files: string[];
  /** Generator that produced the files */
  generator: string;
  /** ISO timestamp */
  generated_at: string;
}

export interface BuildManifest {
  customer_slug: string;
  spec_version: string;
  build_started_at: string;
  build_completed_at?: string;
  entries: ManifestEntry[];
}

// ─── Phase Gate ───────────────────────────────────────────────────────────────

export interface PhaseGateResult {
  phase: string;
  files_created: number;
  spec_amendments: number;
  flags: string[];
  summary: string;
}

// ─── Dev Agent Session ────────────────────────────────────────────────────────

export type DevAgentPhase =
  | "plan"
  | "scaffold"
  | "database"
  | "api"
  | "frontend"
  | "integrations"
  | "ai_touchpoints"
  | "docs"
  | "complete";

export interface DevAgentSession {
  session_id: string;
  customer_slug: string;
  started_at: string;
  updated_at: string;
  current_phase: DevAgentPhase;
  spec_version: string;
  /** Path to the customer's spec.json */
  spec_path: string;
  /** Path to the generated platform directory */
  platform_dir: string;
  /** Approved build plan */
  build_plan: BuildPlan | null;
  /** Accumulated amendments applied so far */
  applied_amendments: SpecAmendment[];
  /** Phase gate results keyed by phase name */
  phase_gates: Record<string, PhaseGateResult>;
}
