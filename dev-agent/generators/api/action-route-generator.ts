/**
 * ERP Forge Dev Agent — Action Route Generator
 *
 * Generates workflow action routes from spec core_workflows.
 * E.g. POST /purchase-orders/:id/confirm from wf_001_s02.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GeneratorContext, GeneratedFile } from "../../types.js";
import { writePlatformFile } from "../../spec-manager.js";
import { buildActionRoutePrompt } from "../../prompts/api.js";
import { FLAG_SPEC_ISSUE_TOOL } from "../../prompts/system.js";
import { handleFlaggedIssue } from "../shared/issue-handler.js";
import type * as readline from "readline";

/**
 * Generates action route handlers for all workflow steps that have a named action.
 *
 * @param ctx - Generator context
 * @param rl - Readline interface for operator input
 * @returns List of generated files
 */
export async function generateActionRoutes(
  ctx: GeneratorContext,
  rl: readline.Interface
): Promise<GeneratedFile[]> {
  const client = new Anthropic({ apiKey: ctx.apiKey });
  const files: GeneratedFile[] = [];

  for (const workflow of ctx.spec.core_workflows) {
    for (const step of workflow.steps) {
      // Skip view/read steps — only generate for state-changing actions
      if (!step.action || step.action === "view" || step.action === "read") continue;
      if (!step.outputs?.length) continue;

      const prompt = buildActionRoutePrompt(ctx.spec, workflow, step);
      if (!prompt) continue;

      const outputEntity = step.outputs[0].entity_ref;
      const resource = outputEntity.replace(/^ent_/, "").replace(/_/g, "-");
      const action = step.action.replace(/_/g, "-");
      const relativePath = `src/app/api/v1/${resource}/[id]/${action}/route.ts`;

      console.log(`  Generating action route: ${step.step_id} (${resource}/${action})...`);

      const content = await generateWithFlagHandling(client, prompt, ctx, rl);
      if (content) {
        writePlatformFile(ctx.platformDir, relativePath, content);
        files.push({
          relativePath,
          content,
          specIds: [step.step_id, workflow.workflow_id],
          generator: "action-route-generator",
        });
      }
    }
  }

  return files;
}

async function generateWithFlagHandling(
  client: Anthropic,
  prompt: string,
  ctx: GeneratorContext,
  rl: readline.Interface
): Promise<string | null> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3072,
      tools: [FLAG_SPEC_ISSUE_TOOL],
      messages,
    });

    if (response.stop_reason === "tool_use") {
      const toolUse = response.content.find((b) => b.type === "tool_use");
      if (toolUse?.type === "tool_use" && toolUse.name === "flag_spec_issue") {
        const input = toolUse.input as {
          section: string;
          issue: string;
          proposed_resolution: string;
          bump_type: "major" | "minor" | "patch";
        };
        const amendment = await handleFlaggedIssue(input, rl);
        ctx.pendingAmendments.push(amendment);
        messages.push({ role: "assistant", content: response.content });
        messages.push({
          role: "user",
          content: [{ type: "tool_result", tool_use_id: toolUse.id, content: `Resolution: ${amendment.approved_resolution}. Continue.` }],
        });
        continue;
      }
    }

    return response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("").trim() || null;
  }
}
