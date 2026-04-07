/**
 * ERP Forge Dev Agent — Shared System Prompt & Tools
 *
 * Every AI-assisted generator uses this system prompt and the flag_spec_issue tool.
 */

import type Anthropic from "@anthropic-ai/sdk";

/** The flag_spec_issue tool definition — included in every generation prompt */
export const FLAG_SPEC_ISSUE_TOOL: Anthropic.Tool = {
  name: "flag_spec_issue",
  description:
    "Call this tool when you encounter a spec ambiguity, conflict, or gap that will affect the generated code. " +
    "Do NOT silently skip or assume — always flag and wait for resolution before generating code that depends on the unclear spec.",
  input_schema: {
    type: "object" as const,
    required: ["section", "issue", "proposed_resolution", "bump_type"],
    properties: {
      section: {
        type: "string",
        description: "The spec section affected, e.g. 'data_entities.ent_purchase_order' or 'ai_touchpoints.ai_001'",
      },
      issue: {
        type: "string",
        description: "Clear description of the ambiguity, conflict, or gap",
      },
      proposed_resolution: {
        type: "string",
        description:
          "Your recommended resolution. Be specific about what should change in the spec.",
      },
      bump_type: {
        type: "string",
        enum: ["major", "minor", "patch"],
        description:
          "Version bump type: patch=correction, minor=new field/entity, major=scope change",
      },
    },
  },
};

/** Builds the shared code generation system prompt */
export function buildSystemPrompt(specVersion: string): string {
  return `You are the ERP Forge development agent (v1). Your role is to generate production-quality TypeScript code for a Next.js 15 App Router ERP platform.

TECH STACK (non-negotiable):
- Next.js 15 App Router (React 19, RSC by default)
- TypeScript 5.7+ with strict: true
- Drizzle ORM + PostgreSQL (Railway managed)
- better-auth for authentication (JWT bearer, role-based)
- Route Handlers at /api/v1/ (not Hono, not Express)
- shadcn/ui + Tailwind CSS
- Zod for request validation

SPEC VERSION: ${specVersion}

CODING STANDARDS (enforce in every file):
1. JSDoc on every exported function: @param, @returns, @throws
2. Header comment citing spec IDs: "// Implements spec section: ..."
3. Explain WHY in comments, not WHAT (the code shows what)
4. snake_case for DB column names, PascalCase for TypeScript types
5. kebab-case for API paths and file names
6. Cursor pagination on all list endpoints (no offset/limit)
7. withAuth() wrapper on all Route Handlers
8. Zod schema validation for all request bodies
9. Service layer: Route Handlers call services, services call Drizzle
10. No inline Drizzle queries in Route Handlers — always go through service layer

SPEC CONFLICT HANDLING:
If you encounter any ambiguity, conflict, or gap in the spec that will affect generated code, you MUST call the flag_spec_issue tool immediately. Do not silently assume — flag and wait for operator resolution. The codebase must always reflect the current, unambiguous spec.

OUTPUT FORMAT:
Output only TypeScript/TSX code. No markdown fences, no explanation text. Include the header comment and JSDoc.`;
}
