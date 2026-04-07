/**
 * ERP Forge Dev Agent — Route Handler Generator
 *
 * AI-assisted generation of Route Handlers for each data entity.
 * Generates: app/api/v1/{resource}/route.ts + app/api/v1/{resource}/[id]/route.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GeneratorContext, GeneratedFile } from "../../types.js";
import { writePlatformFile } from "../../spec-manager.js";
import { buildRouteHandlerPrompt } from "../../prompts/api.js";
import { FLAG_SPEC_ISSUE_TOOL } from "../../prompts/system.js";
import { handleFlaggedIssue } from "../shared/issue-handler.js";
import type * as readline from "readline";

/**
 * Generates Route Handler files for all data entities.
 *
 * @param ctx - Generator context
 * @param rl - Readline interface for operator input
 * @returns List of generated files
 */
export async function generateRouteHandlers(
  ctx: GeneratorContext,
  rl: readline.Interface
): Promise<GeneratedFile[]> {
  const client = new Anthropic({ apiKey: ctx.apiKey });
  const files: GeneratedFile[] = [];

  for (const entity of ctx.spec.data_entities) {
    console.log(`  Generating route handlers: ${entity.entity_id}...`);
    const result = await generateEntityRoutes(ctx, client, entity.entity_id, rl);
    for (const f of result) {
      writePlatformFile(ctx.platformDir, f.relativePath, f.content);
      files.push(f);
    }
  }

  return files;
}

async function generateEntityRoutes(
  ctx: GeneratorContext,
  client: Anthropic,
  entityId: string,
  rl: readline.Interface
): Promise<GeneratedFile[]> {
  const entity = ctx.spec.data_entities.find((e) => e.entity_id === entityId);
  if (!entity) return [];

  const resource = entityId.replace(/^ent_/, "").replace(/_/g, "-");
  const prompt = buildRouteHandlerPrompt(ctx.spec, entity);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 6144,
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
          content: [{ type: "tool_result", tool_use_id: toolUse.id, content: `Operator resolution: ${amendment.approved_resolution}. Continue.` }],
        });
        continue;
      }
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    if (!text.trim()) return [];

    // The prompt asks Claude to generate both files — split on the second file marker
    // Claude is instructed to output both route.ts and [id]/route.ts as separate code blocks
    const parts = splitGeneratedFiles(text, resource);
    return parts;
  }
}

/**
 * Splits Claude's output into separate route files.
 * Claude generates both list route and id route in one response.
 */
function splitGeneratedFiles(text: string, resource: string): GeneratedFile[] {
  // Look for file path markers like "// src/app/api/v1/..." or "// File: ..."
  const idMarker = /\/\/ (?:File: )?src\/app\/api\/v1\/[^/]+\/\[id\]/i;
  const idIndex = text.search(idMarker);

  if (idIndex > 0) {
    const listContent = text.slice(0, idIndex).trim();
    const idContent = text.slice(idIndex).trim();

    return [
      {
        relativePath: `src/app/api/v1/${resource}/route.ts`,
        content: listContent,
        specIds: [],
        generator: "route-handler-generator",
      },
      {
        relativePath: `src/app/api/v1/${resource}/[id]/route.ts`,
        content: idContent,
        specIds: [],
        generator: "route-handler-generator",
      },
    ];
  }

  // Single file output — treat as the list route
  return [
    {
      relativePath: `src/app/api/v1/${resource}/route.ts`,
      content: text.trim(),
      specIds: [],
      generator: "route-handler-generator",
    },
  ];
}
