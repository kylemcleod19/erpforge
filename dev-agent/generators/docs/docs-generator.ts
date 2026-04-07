/**
 * ERP Forge Dev Agent — Documentation Generator
 *
 * AI-assisted generation of HANDOFF.md and CUSTOMER_SUMMARY.md.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GeneratorContext, GeneratedFile } from "../../types.js";
import type { BuildManifest } from "../../types.js";
import { writePlatformFile } from "../../spec-manager.js";
import { buildHandoffPrompt, buildCustomerSummaryPrompt } from "../../prompts/docs.js";

/**
 * Generates developer and customer documentation files.
 *
 * @param ctx - Generator context
 * @param manifest - Current build manifest
 * @param appliedAmendments - Number of spec amendments applied during build
 * @returns List of generated files
 */
export async function generateDocs(
  ctx: GeneratorContext,
  manifest: BuildManifest,
  appliedAmendments: number
): Promise<GeneratedFile[]> {
  const client = new Anthropic({ apiKey: ctx.apiKey });
  const files: GeneratedFile[] = [];

  // HANDOFF.md
  console.log("  Generating HANDOFF.md...");
  const handoffContent = await generateDoc(client, buildHandoffPrompt(ctx.spec, manifest, appliedAmendments));
  if (handoffContent) {
    writePlatformFile(ctx.platformDir, "docs/HANDOFF.md", handoffContent);
    files.push({
      relativePath: "docs/HANDOFF.md",
      content: handoffContent,
      specIds: [],
      generator: "docs-generator",
    });
  }

  // CUSTOMER_SUMMARY.md
  console.log("  Generating CUSTOMER_SUMMARY.md...");
  const summaryContent = await generateDoc(client, buildCustomerSummaryPrompt(ctx.spec));
  if (summaryContent) {
    writePlatformFile(ctx.platformDir, "docs/CUSTOMER_SUMMARY.md", summaryContent);
    files.push({
      relativePath: "docs/CUSTOMER_SUMMARY.md",
      content: summaryContent,
      specIds: [],
      generator: "docs-generator",
    });
  }

  return files;
}

async function generateDoc(client: Anthropic, prompt: string): Promise<string | null> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim() || null;
}
