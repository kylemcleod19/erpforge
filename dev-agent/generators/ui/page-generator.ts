/**
 * ERP Forge Dev Agent — Page Generator
 *
 * AI-assisted generation of RSC pages for screen-type feature requirements.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GeneratorContext, GeneratedFile } from "../../types.js";
import { writePlatformFile } from "../../spec-manager.js";
import { buildServerPagePrompt, buildFormPrompt, buildAppLayoutPrompt, buildLoginPagePrompt } from "../../prompts/frontend.js";
import { FLAG_SPEC_ISSUE_TOOL } from "../../prompts/system.js";
import { handleFlaggedIssue } from "../shared/issue-handler.js";
import type * as readline from "readline";

/**
 * Generates all frontend pages:
 * - Login page
 * - App layout (sidebar + role guard)
 * - RSC list/detail pages for each screen feature
 * - Client Component forms for create/edit
 *
 * @param ctx - Generator context
 * @param rl - Readline interface for operator input
 * @returns List of generated files
 */
export async function generatePages(
  ctx: GeneratorContext,
  rl: readline.Interface
): Promise<GeneratedFile[]> {
  const client = new Anthropic({ apiKey: ctx.apiKey });
  const files: GeneratedFile[] = [];

  // Login page
  console.log("  Generating login page...");
  const loginFile = await generateWithFlags(
    client,
    buildLoginPagePrompt(ctx.spec),
    "src/app/(auth)/login/page.tsx",
    ["development_standards"],
    ctx,
    rl
  );
  if (loginFile) { writePlatformFile(ctx.platformDir, loginFile.relativePath, loginFile.content); files.push(loginFile); }

  // App layout
  console.log("  Generating app layout...");
  const layoutFile = await generateWithFlags(
    client,
    buildAppLayoutPrompt(ctx.spec),
    "src/app/(app)/layout.tsx",
    ["development_standards"],
    ctx,
    rl
  );
  if (layoutFile) { writePlatformFile(ctx.platformDir, layoutFile.relativePath, layoutFile.content); files.push(layoutFile); }

  // Role guard component
  const roleGuard = buildRoleGuardComponent(ctx);
  writePlatformFile(ctx.platformDir, roleGuard.relativePath, roleGuard.content);
  files.push(roleGuard);

  // Screen features — P1 first
  const screenFeatures = ctx.spec.feature_requirements
    .filter((f) => f.type === "screen")
    .sort((a, b) => (a.priority === "P1" ? -1 : 1));

  for (const feature of screenFeatures) {
    const route = feature.name.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "-");

    // Find related entity
    const entity = ctx.spec.data_entities.find(
      (e) =>
        feature.description.toLowerCase().includes(e.name.toLowerCase()) ||
        feature.name.toLowerCase().includes(e.name.toLowerCase())
    ) ?? null;

    console.log(`  Generating page: ${feature.feature_id} (${feature.name})...`);

    // List/detail page
    const pageFile = await generateWithFlags(
      client,
      buildServerPagePrompt(ctx.spec, feature, entity),
      `src/app/(app)/${route}/page.tsx`,
      [feature.feature_id],
      ctx,
      rl
    );
    if (pageFile) { writePlatformFile(ctx.platformDir, pageFile.relativePath, pageFile.content); files.push(pageFile); }

    // Create form (only for screen features with a primary action)
    if (feature.ui_notes?.primary_action) {
      const formFile = await generateWithFlags(
        client,
        buildFormPrompt(ctx.spec, feature, entity),
        `src/app/(app)/${route}/new/page.tsx`,
        [feature.feature_id],
        ctx,
        rl
      );
      if (formFile) { writePlatformFile(ctx.platformDir, formFile.relativePath, formFile.content); files.push(formFile); }
    }
  }

  return files;
}

function buildRoleGuardComponent(ctx: GeneratorContext): GeneratedFile {
  const roles = ctx.spec.development_standards.roles.map((r) => `"${r.role_id}"`).join(" | ");

  const content = `"use client";

/**
 * RoleGuard Component
 * Implements spec section: development_standards.roles
 *
 * Renders children only if the current user's role matches the allowed list.
 * Renders nothing (or a fallback) otherwise — not a redirect.
 * Use the layout.tsx redirect for full page protection.
 */

import { useSession } from "@/lib/auth/client";

interface RoleGuardProps {
  /** Roles allowed to see the wrapped content */
  roles: (${roles})[];
  children: React.ReactNode;
  /** Optional fallback rendered when the user lacks the required role */
  fallback?: React.ReactNode;
}

/**
 * Conditionally renders children based on the current user's role.
 *
 * @param props - roles, children, optional fallback
 * @returns Children if authorized, fallback (or null) otherwise
 */
export function RoleGuard({ roles, children, fallback = null }: RoleGuardProps) {
  const { data: session } = useSession();
  const userRole = session?.user?.role as ${roles} | undefined;

  if (!userRole || !roles.includes(userRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
`;

  return {
    relativePath: "src/components/layout/role-guard.tsx",
    content,
    specIds: ["development_standards"],
    generator: "page-generator",
  };
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
    return { relativePath, content, specIds, generator: "page-generator" };
  }
}
