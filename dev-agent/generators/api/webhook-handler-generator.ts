/**
 * ERP Forge Dev Agent — Webhook Handler Generator
 *
 * Generates inbound webhook Route Handlers for integration_points with inbound endpoints.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GeneratorContext, GeneratedFile } from "../../types.js";
import { writePlatformFile } from "../../spec-manager.js";
import { buildWebhookRoutePrompt } from "../../prompts/api.js";
import { FLAG_SPEC_ISSUE_TOOL } from "../../prompts/system.js";
import { handleFlaggedIssue } from "../shared/issue-handler.js";
import type * as readline from "readline";

/**
 * Generates webhook handler files for all integration_points with inbound endpoints.
 *
 * @param ctx - Generator context
 * @param rl - Readline interface for operator input
 * @returns List of generated files
 */
export async function generateWebhookHandlers(
  ctx: GeneratorContext,
  rl: readline.Interface
): Promise<GeneratedFile[]> {
  const client = new Anthropic({ apiKey: ctx.apiKey });
  const files: GeneratedFile[] = [];

  for (const integration of ctx.spec.integration_points) {
    const hasInbound = integration.endpoints.some(
      (e) => e.direction === "inbound" || e.direction === "bidirectional"
    );
    if (!hasInbound) continue;

    const slug = integration.integration_id.replace("int_", "");
    const relativePath = `src/app/api/v1/webhooks/${slug}/route.ts`;
    console.log(`  Generating webhook handler: ${integration.integration_id}...`);

    const prompt = buildWebhookRoutePrompt(ctx.spec, integration.integration_id);
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
          const input = toolUse.input as { section: string; issue: string; proposed_resolution: string; bump_type: "major" | "minor" | "patch" };
          const amendment = await handleFlaggedIssue(input, rl);
          ctx.pendingAmendments.push(amendment);
          messages.push({ role: "assistant", content: response.content });
          messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: `Resolution: ${amendment.approved_resolution}. Continue.` }] });
          continue;
        }
      }

      const content = response.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("").trim();
      if (content) {
        writePlatformFile(ctx.platformDir, relativePath, content);
        files.push({ relativePath, content, specIds: [integration.integration_id], generator: "webhook-handler-generator" });
      }
      break;
    }
  }

  return files;
}
