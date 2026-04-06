import * as fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import type { InterviewSession } from "../types.js";
import { saveSession, specOutputPath } from "../session.js";
import {
  validateSpec,
  loadSchemaText,
  loadExampleSpecText,
} from "../validate.js";
import { COMPILER_SYSTEM } from "../prompts/system.js";

const MAX_RETRIES = 2;

/**
 * Phase 6: Spec Compiler.
 * Maps session data to spec.json, validates, and writes to disk.
 */
export async function compileSpec(
  session: InterviewSession,
  client: Anthropic
): Promise<InterviewSession> {
  const schemaText = loadSchemaText();
  const exampleText = loadExampleSpecText();
  const sessionSummary = buildSessionSummary(session);

  let specJson: string | null = null;
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const prompt = buildCompilerPrompt(
      schemaText,
      exampleText,
      sessionSummary,
      attempt > 0 ? lastErrors : null
    );

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      system: COMPILER_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    // Strip any accidental markdown fences
    specJson = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Validate
    let parsed: unknown;
    try {
      parsed = JSON.parse(specJson);
    } catch (e) {
      lastErrors = [`JSON parse error: ${String(e)}`];
      continue;
    }

    const result = validateSpec(parsed);
    if (result.valid) {
      // Write to disk
      const outputPath = specOutputPath(session.customer_slug);
      fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
      session.spec_path = outputPath;
      session.current_phase = "complete";
      saveSession(session);
      return session;
    }

    lastErrors = result.errors;
  }

  // All retries exhausted — save best attempt with validation errors noted
  console.error(
    `\n⚠ Spec compiled with validation errors after ${MAX_RETRIES + 1} attempts:`
  );
  lastErrors.slice(0, 10).forEach((e) => console.error(`  • ${e}`));

  const outputPath = specOutputPath(session.customer_slug);
  if (specJson) {
    fs.writeFileSync(outputPath, specJson);
    session.spec_path = outputPath;
    console.error(`  Partial spec saved to ${outputPath}`);
  }

  session.current_phase = "complete";
  saveSession(session);
  return session;
}

function buildSessionSummary(session: InterviewSession): string {
  const parts: string[] = [];

  parts.push("=== INTAKE DATA ===");
  parts.push(JSON.stringify(session.intake, null, 2));

  parts.push("\n=== MODULE RESPONSES ===");
  for (const [id, response] of Object.entries(session.module_responses)) {
    parts.push(`\nModule: ${id}`);
    parts.push(JSON.stringify(response.extracted_data, null, 2));
  }

  if (session.gap_analysis) {
    parts.push("\n=== GAP ANALYSIS ===");
    for (const { question, answer } of session.gap_analysis.gap_responses) {
      parts.push(`Q: ${question}`);
      parts.push(`A: ${answer}`);
    }
  }

  if (session.operator_notes.length > 0) {
    parts.push("\n=== OPERATOR NOTES ===");
    for (const note of session.operator_notes) {
      parts.push(`• ${note.note}`);
      if (note.follow_up_question) {
        parts.push(`  Follow-up: ${note.follow_up_question}`);
      }
    }
  }

  if (session.review_flags.some((f) => f.operator_note)) {
    parts.push("\n=== REVIEW FLAG NOTES ===");
    for (const flag of session.review_flags) {
      if (flag.operator_note) {
        parts.push(`• [${flag.source_module}] ${flag.message}`);
        parts.push(`  Note: ${flag.operator_note}`);
      }
    }
  }

  return parts.join("\n");
}

function buildCompilerPrompt(
  schemaText: string,
  exampleText: string,
  sessionSummary: string,
  previousErrors: string[] | null
): string {
  const errorSection = previousErrors
    ? `\nPREVIOUS VALIDATION ERRORS TO FIX:\n${previousErrors.map((e) => `• ${e}`).join("\n")}\n`
    : "";

  return `Map the following interview session data to a complete ERP Forge spec.json document.
${errorSection}
SCHEMA (spec.schema.json):
${schemaText}

EXAMPLE SPEC (for format reference):
${exampleText}

INTERVIEW SESSION DATA:
${sessionSummary}

MAPPING RULES:
1. Generate a UUID v4 for spec_id
2. Set schema_version to "1.0.0" and spec_version to "1.0.0"
3. Set created_at and updated_at to the current ISO 8601 timestamp
4. Set created_by to "interview_agent_v1"
5. Map industry to the nearest enum value from the schema
6. Map revenue_model answers to the correct enum values
7. Infer data entities from the module responses — create at minimum entities that appear as inputs/outputs in workflows
8. Create core_workflows covering the main order-to-shipment flow based on what the customer described
9. Create feature_requirements from pain points and features discussed
10. Map accounting software to integration_points with appropriate auth_method and category
11. Map shipping carriers to integration_points
12. Set development_standards to these ERP Forge defaults unless customer specified otherwise:
    - api_style: "rest_json"
    - auth_mechanism: "jwt_bearer"
    - architecture_pattern: "modular_monolith"
    - database_type: "relational"
    - api_versioning_strategy: "url_prefix"
    - api_base_path: "/api/v1"
    - test_coverage_threshold: 80
13. Derive roles from the workflow actors and company structure described
14. Add one history entry with change_type "initial_creation" and rationale summarizing the interview
15. Use the ID formats from the schema README (wf_001, ent_purchase_order, feat_001, etc.)
16. Add _section_render and _render flags to audience-specific fields as shown in the example

If information for a required section is missing, make reasonable inferences based on the industry and what was discussed. Add a note in the history rationale about what was inferred.

Output ONLY the JSON spec document. No markdown, no explanation.`;
}
