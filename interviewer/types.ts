import type Anthropic from "@anthropic-ai/sdk";

// ─── Claude API ───────────────────────────────────────────────────────────────

export type Message = Anthropic.MessageParam;

// ─── Intake ───────────────────────────────────────────────────────────────────

export interface IntakeData {
  company_name: string;
  industry: string; // mapped to schema enum
  industry_display: string; // human-readable
  employees: number;
  revenue_band: string; // under_1M | 1M_10M | 10M_50M | 50M_plus
  revenue_model: string[]; // schema enum values
  manufacturing_sites: number;
  current_software: string[];
  pain_points: Array<{ description: string; severity: string }>;
  success_metrics: string[];
  certifications: string[];
  has_compliance_requirements: boolean;
  workflow_summary: string; // natural-language paragraph for research prompts
  routing_signals: string[]; // free-text signals for module router
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export interface QuestionGuide {
  question: string;
  captures: string; // what this question extracts
}

export interface ReviewFlagTrigger {
  condition: string; // free-text description of the trigger condition
  flagMessage: string;
  suggestedAction: string;
}

export interface ModuleDefinition {
  id: string;
  name: string;
  alwaysRun: boolean;
  triggerSignals: string[];
  openingTemplate: (customerContext: string) => string;
  questions: QuestionGuide[];
  artifactPrompt: string | null;
  reviewFlagTriggers: ReviewFlagTrigger[];
  searchQueries: (industry: string, certifications: string[]) => string[];
  /** Fields the extraction call should pull out of the module conversation */
  extractionFields: string[];
}

export interface ModuleResponse {
  module_id: string;
  completed_at: string;
  raw_transcript_start_index: number; // index into session.messages where module started
  extracted_data: Record<string, unknown>;
  review_flags_raised: ReviewFlag[];
}

// ─── Research ─────────────────────────────────────────────────────────────────

export interface ResearchResult {
  module_id: string;
  industry: string;
  run_at: string;
  search_queries: string[];
  findings_summary: string;
  industry_specific_requirements: string[];
  industry_specific_questions: string[];
  gaps_vs_standard_questions: string[];
}

export interface GapAnalysisResult {
  run_at: string;
  gap_questions: string[];
  gap_responses: Array<{ question: string; answer: string }>;
}

// ─── Review ───────────────────────────────────────────────────────────────────

export type ReviewFlagSeverity = "info" | "warning" | "blocker";

export interface ReviewFlag {
  id: string;
  source_module: string;
  trigger_condition: string;
  message: string;
  suggested_action: string;
  severity: ReviewFlagSeverity;
  operator_disposition?: "approved" | "noted" | "skipped";
  operator_note?: string;
}

export interface OperatorNote {
  added_at: string;
  note: string;
  follow_up_question?: string;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export type InterviewPhase =
  | "intake"
  | "routing"
  | "modules"
  | "gap_analysis"
  | "review"
  | "compilation"
  | "complete";

export interface InterviewSession {
  session_id: string;
  customer_slug: string;
  started_at: string;
  updated_at: string;
  current_phase: InterviewPhase;
  /** Which module is currently being interviewed (null if not in modules phase) */
  current_module: string | null;
  intake: IntakeData | null;
  selected_modules: Array<{ module_id: string; priority: "P1" | "P2" }>;
  completed_modules: string[];
  module_responses: Record<string, ModuleResponse>;
  /** Keyed by `${module_id}:${industry}` */
  research_cache: Record<string, ResearchResult>;
  gap_analysis: GapAnalysisResult | null;
  review_flags: ReviewFlag[];
  operator_notes: OperatorNote[];
  /** Full conversation history (customer-visible turns only) */
  messages: Message[];
  /** Paths to uploaded artifact files */
  artifacts: string[];
  /** Set when spec compilation succeeds */
  spec_path: string | null;
}
