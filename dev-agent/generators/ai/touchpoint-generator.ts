/**
 * ERP Forge Dev Agent — AI Touchpoint Generator
 *
 * Generates lib/ai/{slug}.ts and app/api/v1/ai/{slug}/route.ts for each ai_touchpoint.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GeneratorContext, GeneratedFile } from "../../types.js";
import { writePlatformFile } from "../../spec-manager.js";
import { buildAiTouchpointPrompt, buildAiClientPrompt } from "../../prompts/ai.js";
import { FLAG_SPEC_ISSUE_TOOL, buildSystemPrompt } from "../../prompts/system.js";
import { handleFlaggedIssue } from "../shared/issue-handler.js";
import type * as readline from "readline";

/**
 * Generates the Anthropic client singleton and all AI touchpoint handler files.
 *
 * @param ctx - Generator context
 * @param rl - Readline interface for operator input
 * @returns List of generated files
 */
export async function generateAiTouchpoints(
  ctx: GeneratorContext,
  rl: readline.Interface
): Promise<GeneratedFile[]> {
  const client = new Anthropic({ apiKey: ctx.apiKey });
  const files: GeneratedFile[] = [];

  // Generate Anthropic client singleton
  const clientFile = await generateFile(
    client,
    buildAiClientPrompt(ctx.spec),
    "src/lib/ai/client.ts",
    [],
    ctx,
    rl
  );
  if (clientFile) {
    writePlatformFile(ctx.platformDir, clientFile.relativePath, clientFile.content);
    files.push(clientFile);
  }

  // Generate each touchpoint handler + API route
  for (const touchpoint of ctx.spec.ai_touchpoints) {
    const slug = touchpoint.touchpoint_id.replace(/^ai_/, "");
    console.log(`  Generating AI touchpoint: ${touchpoint.touchpoint_id}...`);

    // lib/ai/{slug}.ts
    const handlerFile = await generateFile(
      client,
      buildAiTouchpointPrompt(ctx.spec, touchpoint),
      `src/lib/ai/${slug}.ts`,
      [touchpoint.touchpoint_id],
      ctx,
      rl
    );
    if (handlerFile) {
      writePlatformFile(ctx.platformDir, handlerFile.relativePath, handlerFile.content);
      files.push(handlerFile);
    }

    // app/api/v1/ai/{slug}/route.ts
    const routePrompt = buildAiRoutePrompt(ctx.spec.spec_version, touchpoint.touchpoint_id, slug, touchpoint.name);
    const routeFile = await generateFile(
      client,
      routePrompt,
      `src/app/api/v1/ai/${slug}/route.ts`,
      [touchpoint.touchpoint_id],
      ctx,
      rl
    );
    if (routeFile) {
      writePlatformFile(ctx.platformDir, routeFile.relativePath, routeFile.content);
      files.push(routeFile);
    }
  }

  return files;
}

function buildAiRoutePrompt(specVersion: string, touchpointId: string, slug: string, name: string): string {
  return `${buildSystemPrompt(specVersion)}

Generate src/app/api/v1/ai/${slug}/route.ts

/**
 * ${name} — AI Route Handler
 * Implements: ${touchpointId}
 * Endpoint: POST /api/v1/ai/${slug}
 */

REQUIREMENTS:
1. POST handler with withAuth() wrapping
2. Validate request body with Zod (must match the input parameters of the ${slug} function from lib/ai/${slug}.ts)
3. Call the ${slug} function from @/lib/ai/${slug}
4. If result.pending_review is true, return 202 Accepted with the result for human review
5. Otherwise return 200 ok() with the result
6. Handle errors with apiError()`;
}

async function generateFile(
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
        const input = toolUse.input as { section: string; issue: string; proposed_resolution: string; bump_type: "major" | "minor" | "patch" };
        const amendment = await handleFlaggedIssue(input, rl);
        ctx.pendingAmendments.push(amendment);
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: `Resolution: ${amendment.approved_resolution}. Continue.` }] });
        continue;
      }
    }

    const content = response.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    if (!content) return null;

    return { relativePath, content, specIds, generator: "touchpoint-generator" };
  }
}
