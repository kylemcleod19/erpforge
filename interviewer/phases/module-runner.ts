import Anthropic from "@anthropic-ai/sdk";
import type {
  InterviewSession,
  ModuleResponse,
  ReviewFlag,
  Message,
} from "../types.js";
import { saveSession } from "../session.js";
import { getModule } from "../modules/index.js";
import { runResearchGate } from "./researcher.js";
import {
  BASE_PERSONA,
  EXTRACTION_SYSTEM,
  buildCustomerContext,
} from "../prompts/system.js";
import { v4 as uuidv4 } from "uuid";

function buildModuleSystemPrompt(
  moduleId: string,
  customerContext: string,
  researchFindings: string,
  industryQuestions: string[]
): string {
  const mod = getModule(moduleId);

  const extraQs =
    industryQuestions.length > 0
      ? `\nIndustry-specific questions to add if not naturally covered:\n${industryQuestions.map((q) => `- ${q}`).join("\n")}`
      : "";

  return `${BASE_PERSONA}

You are in the ${mod.name.toUpperCase()} module interview.

Customer context: ${customerContext}

Research findings for this industry:
${researchFindings}
${extraQs}

Standard questions to cover (rephrase naturally, reference the customer's own terms):
${mod.questions.map((q, i) => `${i + 1}. ${q.question} (captures: ${q.captures})`).join("\n")}

${
  mod.artifactPrompt
    ? `When appropriate, make this artifact request: "${mod.artifactPrompt}"`
    : ""
}

When you have covered the key questions for this module, call the complete_module tool.
Reference the customer's specific product names and terms — never use generic placeholder language.`;
}

const COMPLETE_MODULE_TOOL: Anthropic.Tool = {
  name: "complete_module",
  description:
    "Call this when you have sufficiently covered all key questions for the current module. Do not call until the core questions have been addressed.",
  input_schema: {
    type: "object" as const,
    properties: {
      ready: { type: "boolean" },
      summary: {
        type: "string",
        description: "One-sentence summary of what you learned in this module",
      },
    },
    required: ["ready", "summary"],
  },
};

/**
 * Runs a single module interview, preceded by the research gate.
 */
export async function runModule(
  session: InterviewSession,
  moduleId: string,
  client: Anthropic,
  onMessage: (role: "assistant" | "user", content: string) => Promise<string>,
  onStatusMessage: (msg: string) => void
): Promise<InterviewSession> {
  const mod = getModule(moduleId);
  session.current_module = moduleId;
  saveSession(session);

  // ── 3a. Research Gate ──────────────────────────────────────────────────────
  const research = await runResearchGate(session, moduleId, client, onStatusMessage);

  // ── 3b. Module Interview ───────────────────────────────────────────────────
  const intake = session.intake!;
  const customerContext = buildCustomerContext(
    intake.company_name,
    intake.industry_display,
    intake.workflow_summary
  );

  const systemPrompt = buildModuleSystemPrompt(
    moduleId,
    customerContext,
    research.findings_summary,
    research.industry_specific_questions
  );

  // Opening line for this module
  const openingLine = mod.openingTemplate(
    `You mentioned ${intake.workflow_summary.split(".")[0].toLowerCase()}.`
  );

  const moduleStartIndex = session.messages.length;

  const userResponse = await onMessage("assistant", openingLine);
  session.messages.push({ role: "assistant", content: openingLine });
  session.messages.push({ role: "user", content: userResponse });
  saveSession(session);

  let moduleDone = false;

  while (!moduleDone) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools: [COMPLETE_MODULE_TOOL],
      messages: session.messages as Anthropic.MessageParam[],
    });

    for (const block of response.content) {
      if (block.type === "text") {
        const nextUserResponse = await onMessage("assistant", block.text);
        session.messages.push({ role: "assistant", content: block.text });
        session.messages.push({ role: "user", content: nextUserResponse });
        saveSession(session);
      } else if (block.type === "tool_use" && block.name === "complete_module") {
        moduleDone = true;

        // Acknowledge tool call
        session.messages.push({
          role: "assistant",
          content: response.content,
        } as Message);
        session.messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: block.id,
              content: "Module complete.",
            },
          ],
        } as Message);

        // Extract structured data from this module's conversation
        const moduleTranscript = session.messages
          .slice(moduleStartIndex)
          .filter((m) => typeof m.content === "string")
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join("\n\n");

        const extractedData = await extractModuleData(
          moduleId,
          moduleTranscript,
          client
        );

        // Evaluate review flags
        const raisedFlags = await evaluateReviewFlags(
          moduleId,
          extractedData,
          client
        );

        const moduleResponse: ModuleResponse = {
          module_id: moduleId,
          completed_at: new Date().toISOString(),
          raw_transcript_start_index: moduleStartIndex,
          extracted_data: extractedData,
          review_flags_raised: raisedFlags,
        };

        session.module_responses[moduleId] = moduleResponse;
        session.completed_modules.push(moduleId);
        session.review_flags.push(...raisedFlags);
        session.current_module = null;
        saveSession(session);
        break;
      }
    }
  }

  return session;
}

/**
 * Runs all selected modules in order.
 */
export async function runAllModules(
  session: InterviewSession,
  client: Anthropic,
  onMessage: (role: "assistant" | "user", content: string) => Promise<string>,
  onStatusMessage: (msg: string) => void
): Promise<InterviewSession> {
  const modules = session.selected_modules;

  for (let i = 0; i < modules.length; i++) {
    const { module_id } = modules[i];

    // Skip if already completed (resume support)
    if (session.completed_modules.includes(module_id)) continue;

    // Transition message between modules (not before the first)
    if (i > 0 && session.completed_modules.length > 0) {
      const prevModule = getModule(
        session.completed_modules[session.completed_modules.length - 1]
      );
      const currModule = getModule(module_id);
      const transition = `Moving on to ${currModule.name.toLowerCase()}.`;
      const bridgeResponse = await onMessage("assistant", transition);
      session.messages.push({ role: "assistant", content: transition });
      session.messages.push({ role: "user", content: bridgeResponse });
      saveSession(session);
    }

    session = await runModule(session, module_id, client, onMessage, onStatusMessage);
  }

  session.current_phase = "gap_analysis";
  saveSession(session);
  return session;
}

async function extractModuleData(
  moduleId: string,
  transcript: string,
  client: Anthropic
): Promise<Record<string, unknown>> {
  const mod = getModule(moduleId);
  const fields = mod.extractionFields;

  const prompt = `Extract these fields from the interview transcript. Use null for anything not discussed.

Fields: ${fields.join(", ")}

Transcript:
${transcript}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: EXTRACTION_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "{}";

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function evaluateReviewFlags(
  moduleId: string,
  extractedData: Record<string, unknown>,
  client: Anthropic
): Promise<ReviewFlag[]> {
  const mod = getModule(moduleId);
  if (mod.reviewFlagTriggers.length === 0) return [];

  const prompt = `Given this extracted data from a ${mod.name} module interview:
${JSON.stringify(extractedData, null, 2)}

Check whether any of these flag conditions are met:
${JSON.stringify(mod.reviewFlagTriggers, null, 2)}

Return a JSON array of triggered flags. Each triggered flag should include:
{
  "trigger_condition": "...",
  "message": "...",
  "suggested_action": "...",
  "severity": "info" | "warning" | "blocker"
}

If no flags are triggered, return an empty array [].
Output ONLY valid JSON.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: "You are a business analyst evaluating interview data for review flags. Output only valid JSON.",
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "[]";

  try {
    const raw = JSON.parse(text) as Array<{
      trigger_condition: string;
      message: string;
      suggested_action: string;
      severity: "info" | "warning" | "blocker";
    }>;

    return raw.map((f) => ({
      id: uuidv4(),
      source_module: moduleId,
      trigger_condition: f.trigger_condition,
      message: f.message,
      suggested_action: f.suggested_action,
      severity: f.severity ?? "warning",
    }));
  } catch {
    return [];
  }
}
