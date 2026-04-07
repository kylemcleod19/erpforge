/**
 * ERP Forge Dev Agent — Database Prompts
 *
 * Prompts for Drizzle schema generation. Database generation is rule-based
 * (no AI) but these prompts are used for the seed generator.
 */

import type { ErpSpec, DataEntity, DevelopmentStandards } from "../types.js";

/**
 * Builds the prompt for generating the Drizzle db/index.ts singleton.
 */
export function buildDbIndexPrompt(spec: ErpSpec): string {
  return `Generate src/db/index.ts for a Next.js 15 App Router ERP platform.

// Implements spec section: development_standards
// Customer: ${spec.business_profile.company_name}

Requirements:
- Import postgres from "postgres" and drizzle from "drizzle-orm/postgres-js"
- Use DATABASE_URL from process.env (throw clear error if missing)
- Export a singleton db instance
- Export all schema tables via "export * from './schema/index.js'"
- The connection should work in both Next.js server context and scripts/migrate.ts

Output only the TypeScript file content.`;
}

/**
 * Builds the prompt for the database seed file.
 */
export function buildSeedPrompt(spec: ErpSpec): string {
  const roles = spec.development_standards.roles;
  const adminRole = roles.find((r) => r.role_id.includes("admin")) ?? roles[0];

  return `Generate db/seed.ts for the ERP platform.

// Implements spec section: development_standards.roles, data_entities
// Customer: ${spec.business_profile.company_name}

Requirements:
- Creates one admin user (email: admin@example.com, password: changeme) with role "${adminRole?.role_id ?? "admin"}"
- Uses better-auth's createUser() method (not direct DB insert — better-auth manages password hashing)
- Checks if admin user already exists before inserting (idempotent)
- Logs "Seed complete" on success
- Designed to be run via: npx tsx db/seed.ts

Roles defined in spec: ${roles.map((r) => `${r.role_id} (${r.name})`).join(", ")}

Output only the TypeScript file content.`;
}

/**
 * Builds context string describing an entity for embedding in other prompts.
 */
export function entityToContext(entity: DataEntity): string {
  const fields = entity.fields
    .map(
      (f) =>
        `  - ${f.field_id} (${f.type}${f.required ? ", required" : ""}${f.enum_values ? `, enum: [${f.enum_values.join(", ")}]` : ""})`
    )
    .join("\n");

  const rels = entity.relationships
    ?.map(
      (r) =>
        `  - ${r.type} ${r.entity}${r.cascade ? ` (cascade: ${r.cascade})` : ""}`
    )
    .join("\n");

  return [
    `Entity: ${entity.entity_id} (${entity.name})`,
    `Description: ${entity.description}`,
    `Fields:\n${fields}`,
    rels ? `Relationships:\n${rels}` : null,
    entity.soft_delete ? "soft_delete: true" : null,
    entity.audit_trail ? "audit_trail: true" : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Drizzle column type mapping from spec field types.
 * Used by the rule-based schema generator.
 */
export const DRIZZLE_TYPE_MAP: Record<string, string> = {
  uuid: "uuid().defaultRandom()",
  string: "varchar({ length: 255 })",
  text: "text()",
  integer: "integer()",
  decimal: "numeric({ precision: 12, scale: 4 })",
  boolean: "boolean()",
  datetime: "timestamp({ withTimezone: true })",
  json_blob: "jsonb()",
  file_ref: "varchar({ length: 512 })",
  // enum is handled specially — generates a pgEnum
};
