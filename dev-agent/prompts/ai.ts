/**
 * ERP Forge Dev Agent — AI Touchpoint Prompts
 *
 * Prompts for generating Anthropic SDK touchpoint handlers.
 */

import type { ErpSpec, AiTouchpoint } from "../types.js";
import { buildSystemPrompt } from "./system.js";

/** Maps spec model_preference to actual Anthropic model IDs */
export const MODEL_ID_MAP: Record<string, string> = {
  "claude-haiku": "claude-haiku-4-5-20251001",
  "claude-sonnet": "claude-sonnet-4-6",
  "claude-opus": "claude-opus-4-6",
};

/**
 * Builds the prompt for an AI touchpoint handler.
 */
export function buildAiTouchpointPrompt(
  spec: ErpSpec,
  touchpoint: AiTouchpoint
): string {
  const modelId = MODEL_ID_MAP[touchpoint.model_preference] ?? "claude-sonnet-4-6";
  const slug = touchpoint.touchpoint_id.replace(/^ai_/, "");

  return `${buildSystemPrompt(spec.spec_version)}

Generate src/lib/ai/${slug}.ts

/**
 * ${touchpoint.name} — AI Touchpoint Handler
 * Implements: ${touchpoint.touchpoint_id}
 * Trigger: ${touchpoint.trigger}
 * Agent type: ${touchpoint.agent_type}
 * Model: ${modelId}
 */

TOUCHPOINT SPEC:
${JSON.stringify(touchpoint, null, 2)}

MODEL: ${modelId}

REQUIREMENTS:
1. Export one main async function named after the touchpoint (camelCase)
2. Function signature should accept the input_context.provided_to_agent fields as typed parameters
3. Build the system prompt explaining the agent's role and output format
4. Build the user message from the provided inputs
5. Call Anthropic SDK (import from lib/ai/client.ts) with model: "${modelId}"
6. ${
    touchpoint.confidence_threshold != null
      ? `Check confidence in the response. If < ${touchpoint.confidence_threshold}, apply fallback: ${touchpoint.fallback_strategy ?? "throw an error with clear message"}`
      : "Parse and return the response"
  }
7. ${
    touchpoint.human_in_the_loop.required
      ? `Human-in-the-loop required: ${touchpoint.human_in_the_loop.condition ?? "always"}. Return a "pending_review" status with the AI output for the operator to confirm before applying.`
      : "Return the parsed output directly"
  }
8. Output format: ${touchpoint.expected_output.format}${touchpoint.expected_output.fields ? ` with fields: ${touchpoint.expected_output.fields.join(", ")}` : ""}
9. Export a TypeScript type for the return value matching the expected output
10. Include JSDoc explaining WHEN to call this function and what it does (why, not what)`;
}

/**
 * Builds the prompt for the Anthropic client singleton (lib/ai/client.ts).
 */
export function buildAiClientPrompt(spec: ErpSpec): string {
  return `${buildSystemPrompt(spec.spec_version)}

Generate src/lib/ai/client.ts

/**
 * Anthropic SDK Client Singleton
 * Implements: development_standards (AI touchpoints infrastructure)
 * Customer: ${spec.business_profile.company_name}
 */

REQUIREMENTS:
1. Import Anthropic from "@anthropic-ai/sdk"
2. Create and export a singleton: const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
3. Throw clear error at startup if ANTHROPIC_API_KEY is missing
4. Export the client as default and named export
5. Keep this file minimal — just the singleton, no helper functions`;
}
