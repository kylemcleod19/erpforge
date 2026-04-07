/**
 * ERP Forge Dev Agent — Integration Generator
 *
 * AI-assisted generation of lib/integrations/{slug}/ for each integration_point.
 * Generates: client.ts, oauth.ts (if OAuth2), sync.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GeneratorContext, GeneratedFile } from "../../types.js";
import { writePlatformFile } from "../../spec-manager.js";
import {
  buildIntegrationClientPrompt,
  buildOAuthPrompt,
  buildSyncPrompt,
} from "../../prompts/integrations.js";
import { FLAG_SPEC_ISSUE_TOOL } from "../../prompts/system.js";
import { handleFlaggedIssue } from "../shared/issue-handler.js";
import type * as readline from "readline";

/**
 * Generates integration files for all integration_points.
 *
 * @param ctx - Generator context
 * @param rl - Readline interface for operator input
 * @returns List of generated files
 */
export async function generateIntegrations(
  ctx: GeneratorContext,
  rl: readline.Interface
): Promise<GeneratedFile[]> {
  const client = new Anthropic({ apiKey: ctx.apiKey });
  const files: GeneratedFile[] = [];

  for (const integration of ctx.spec.integration_points) {
    const slug = integration.integration_id.replace("int_", "");
    console.log(`  Generating integration: ${integration.integration_id} (${integration.name})...`);

    // client.ts — always generated
    const clientFile = await generateWithFlags(
      client,
      buildIntegrationClientPrompt(ctx.spec, integration),
      `src/lib/integrations/${slug}/client.ts`,
      [integration.integration_id],
      ctx,
      rl
    );
    if (clientFile) {
      writePlatformFile(ctx.platformDir, clientFile.relativePath, clientFile.content);
      files.push(clientFile);
    }

    // oauth.ts — only for OAuth2 integrations
    if (integration.auth_method === "oauth2") {
      const oauthFile = await generateWithFlags(
        client,
        buildOAuthPrompt(ctx.spec, integration),
        `src/lib/integrations/${slug}/oauth.ts`,
        [integration.integration_id],
        ctx,
        rl
      );
      if (oauthFile) {
        writePlatformFile(ctx.platformDir, oauthFile.relativePath, oauthFile.content);
        files.push(oauthFile);
      }
    }

    // sync.ts — only if there are outbound endpoints
    const hasOutbound = integration.endpoints.some(
      (e) => e.direction === "outbound" || e.direction === "bidirectional"
    );
    if (hasOutbound) {
      const syncFile = await generateWithFlags(
        client,
        buildSyncPrompt(ctx.spec, integration),
        `src/lib/integrations/${slug}/sync.ts`,
        [integration.integration_id],
        ctx,
        rl
      );
      if (syncFile) {
        writePlatformFile(ctx.platformDir, syncFile.relativePath, syncFile.content);
        files.push(syncFile);
      }
    }
  }

  return files;
}

async function generateWithFlags(
  client: Anthropic,
  prompt: string,
  relativePath: string,
  specIds: string[],
  ctx: GeneratorContext,
  rl: readline.Interface
): Promise<GeneratedFile | null> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
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

    const content = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    if (!content) return null;
    return { relativePath, content, specIds, generator: "integration-generator" };
  }
}
