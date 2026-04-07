/**
 * ERP Forge Dev Agent — Service Generator
 *
 * AI-assisted generation of services/{entity}.service.ts files.
 * Each service contains CRUD + business logic for one spec data_entity.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GeneratorContext, GeneratedFile, SpecAmendment } from "../../types.js";
import { writePlatformFile } from "../../spec-manager.js";
import { buildServicePrompt } from "../../prompts/api.js";
import { FLAG_SPEC_ISSUE_TOOL } from "../../prompts/system.js";
import { handleFlaggedIssue } from "../shared/issue-handler.js";
import type * as readline from "readline";

/**
 * Generates service layer files for all data entities.
 * Each service is generated with AI assistance using the entity spec + workflow rules.
 *
 * @param ctx - Generator context
 * @param rl - Readline interface for operator input on spec issues
 * @returns List of generated files
 */
export async function generateServices(
  ctx: GeneratorContext,
  rl: readline.Interface
): Promise<GeneratedFile[]> {
  const client = new Anthropic({ apiKey: ctx.apiKey });
  const files: GeneratedFile[] = [];

  for (const entity of ctx.spec.data_entities) {
    console.log(`  Generating service: ${entity.entity_id}...`);

    const result = await generateEntityService(ctx, client, entity.entity_id, rl);
    if (result) {
      writePlatformFile(ctx.platformDir, result.relativePath, result.content);
      files.push(result);
    }
  }

  return files;
}

async function generateEntityService(
  ctx: GeneratorContext,
  client: Anthropic,
  entityId: string,
  rl: readline.Interface
): Promise<GeneratedFile | null> {
  const entity = ctx.spec.data_entities.find((e) => e.entity_id === entityId);
  if (!entity) return null;

  const prompt = buildServicePrompt(ctx.spec, entity);
  const serviceSlug = entityId.replace(/^ent_/, "").replace(/_/g, "-");

  // Generation loop — handles flag_spec_issue tool calls
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools: [FLAG_SPEC_ISSUE_TOOL],
      messages,
    });

    if (response.stop_reason === "tool_use") {
      // Handle spec issue flag
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
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: `Operator resolution: ${amendment.approved_resolution}. Continue generation with this resolution applied.`,
            },
          ],
        });
        continue;
      }
    }

    // Extract code from response
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    if (!text.trim()) return null;

    return {
      relativePath: `src/services/${serviceSlug}.service.ts`,
      content: text.trim(),
      specIds: [entityId],
      generator: "service-generator",
    };
  }
}
