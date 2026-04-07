/**
 * ERP Forge Dev Agent — Drizzle Schema Generator
 *
 * Rule-based transformation: spec data_entities[] → src/db/schema/*.ts
 * Deterministic — no AI calls. Every spec field type maps to an exact Drizzle column.
 */

import type { GeneratorContext, GeneratedFile, DataEntity, FieldDescriptor } from "../../types.js";
import { writePlatformFile } from "../../spec-manager.js";
import { DRIZZLE_TYPE_MAP } from "../../prompts/database.js";

/**
 * Generates Drizzle schema files for all entities in the spec.
 * Also generates src/db/index.ts (singleton) and src/db/schema/index.ts (re-export).
 *
 * @param ctx - Generator context with spec and platform directory
 * @returns List of generated files
 */
export function generateDrizzleSchema(ctx: GeneratorContext): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Generate one schema file per entity
  for (const entity of ctx.spec.data_entities) {
    const file = generateEntitySchema(entity, ctx.spec.data_entities);
    writePlatformFile(ctx.platformDir, file.relativePath, file.content);
    files.push(file);
  }

  // Generate auth schema (better-auth required tables)
  const authSchema = generateAuthSchema();
  writePlatformFile(ctx.platformDir, authSchema.relativePath, authSchema.content);
  files.push(authSchema);

  // Generate schema index (re-exports all tables)
  const schemaIndex = generateSchemaIndex(ctx.spec.data_entities);
  writePlatformFile(ctx.platformDir, schemaIndex.relativePath, schemaIndex.content);
  files.push(schemaIndex);

  // Generate db/index.ts (Drizzle singleton)
  const dbIndex = generateDbIndex();
  writePlatformFile(ctx.platformDir, dbIndex.relativePath, dbIndex.content);
  files.push(dbIndex);

  return files;
}

function generateEntitySchema(
  entity: DataEntity,
  allEntities: DataEntity[]
): GeneratedFile {
  const fileName = entity.entity_id.replace(/^ent_/, "").replace(/_/g, "-");
  const tableName = entity.entity_id.replace(/^ent_/, "").replace(/-/g, "_").replace(/([A-Z])/g, "_$1").toLowerCase();
  const TypeName = toPascalCase(entity.entity_id.replace(/^ent_/, ""));

  // Collect enum definitions
  const enumFields = entity.fields.filter((f) => f.type === "enum" && f.enum_values?.length);
  const enumDefs = enumFields.map((f) => ({
    name: `${tableName}_${f.field_id}`,
    values: f.enum_values!,
  }));

  // Collect foreign key imports
  const foreignImports: Array<{ tableName: string; fileName: string }> = [];
  for (const rel of entity.relationships ?? []) {
    const refEntity = allEntities.find((e) => e.entity_id === rel.entity || e.name === rel.entity);
    if (refEntity) {
      const refFileName = refEntity.entity_id.replace(/^ent_/, "").replace(/_/g, "-");
      const refTableName = refEntity.entity_id.replace(/^ent_/, "").replace(/-/g, "_").replace(/([A-Z])/g, "_$1").toLowerCase();
      if (!foreignImports.some((fi) => fi.fileName === refFileName)) {
        foreignImports.push({ tableName: refTableName, fileName: refFileName });
      }
    }
  }

  // Determine required drizzle column imports
  const columnTypeImports = new Set<string>(["pgTable", "uuid"]);
  if (entity.soft_delete) columnTypeImports.add("timestamp");
  if (entity.audit_trail) columnTypeImports.add("timestamp");
  if (enumDefs.length > 0) columnTypeImports.add("pgEnum");

  // Build column definitions
  const columnLines: string[] = [];
  for (const field of entity.fields) {
    if (field.field_id === "id") continue; // id is always uuid primary key
    const col = buildColumnDef(field, enumDefs, tableName, columnTypeImports);
    columnLines.push(`  ${field.field_id}: ${col},`);
  }

  // Relationship foreign keys
  for (const rel of entity.relationships ?? []) {
    if (rel.type === "belongs_to" && rel.foreign_key) {
      const refEntity = allEntities.find((e) => e.entity_id === rel.entity || e.name === rel.entity);
      const refTableName = refEntity
        ? refEntity.entity_id.replace(/^ent_/, "").replace(/-/g, "_").replace(/([A-Z])/g, "_$1").toLowerCase()
        : rel.entity;
      const onDelete = rel.cascade === "delete" ? ".onDeleteCascade()" : rel.cascade === "restrict" ? ".onDelete('restrict')" : rel.cascade === "set_null" ? ".onDelete('set null')" : "";
      columnTypeImports.add("uuid");
      columnLines.push(
        `  ${rel.foreign_key}: uuid("${rel.foreign_key}").references(() => ${refTableName}.id${onDelete})${rel.foreign_key.endsWith("Id") ? "" : ""},`
      );
    }
  }

  const importLine = `import { ${Array.from(columnTypeImports).join(", ")} } from "drizzle-orm/pg-core";`;
  const foreignImportLines = foreignImports
    .map((fi) => `import { ${fi.tableName} } from "./${fi.fileName}.js";`)
    .join("\n");

  const enumLines = enumDefs
    .map((ed) => `export const ${ed.name}Enum = pgEnum("${ed.name}", [${ed.values.map((v) => `"${v}"`).join(", ")}]);`)
    .join("\n");

  const lines = [
    `/**`,
    ` * ${entity.name} Drizzle Schema`,
    ` * Implements spec section: data_entities.${entity.entity_id}`,
    ` */`,
    "",
    importLine,
    foreignImportLines || null,
    enumLines || null,
    "",
    `export const ${tableName} = pgTable("${tableName}", {`,
    `  id: uuid("id").defaultRandom().primaryKey(),`,
    ...columnLines,
    entity.soft_delete ? `  deletedAt: timestamp("deleted_at", { withTimezone: true }),` : null,
    entity.audit_trail ? `  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),` : null,
    entity.audit_trail ? `  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),` : null,
    `});`,
    "",
    `export type ${TypeName} = typeof ${tableName}.$inferSelect;`,
    `export type New${TypeName} = typeof ${tableName}.$inferInsert;`,
  ].filter((l) => l !== null).join("\n");

  return {
    relativePath: `src/db/schema/${fileName}.ts`,
    content: lines,
    specIds: [entity.entity_id],
    generator: "schema-generator",
  };
}

function buildColumnDef(
  field: FieldDescriptor,
  enumDefs: Array<{ name: string; values: string[] }>,
  tableName: string,
  imports: Set<string>
): string {
  const columnName = field.field_id;

  if (field.type === "enum") {
    const enumName = `${tableName}_${field.field_id}`;
    const base = `${enumName}Enum("${columnName}")`;
    return field.required ? base : `${base}.notNull()`;
  }

  let drizzleType = DRIZZLE_TYPE_MAP[field.type] ?? "text()";

  // Track needed imports
  if (field.type === "uuid") imports.add("uuid");
  else if (field.type === "string") imports.add("varchar");
  else if (field.type === "text") imports.add("text");
  else if (field.type === "integer") imports.add("integer");
  else if (field.type === "decimal") imports.add("numeric");
  else if (field.type === "boolean") imports.add("boolean");
  else if (field.type === "datetime") imports.add("timestamp");
  else if (field.type === "json_blob") imports.add("jsonb");
  else if (field.type === "file_ref") imports.add("varchar");

  const base = `${drizzleType.split("(")[0]}("${columnName}"${drizzleType.includes("(") ? ", " + drizzleType.slice(drizzleType.indexOf("(") + 1, drizzleType.lastIndexOf(")")) + ")" : ")"}`;

  return field.required ? `${base}.notNull()` : base;
}

function generateAuthSchema(): GeneratedFile {
  const content = `/**
 * better-auth Required Tables
 * Implements spec section: development_standards (auth_mechanism: jwt_bearer)
 *
 * These tables are managed by better-auth and must NOT be modified manually.
 * See https://www.better-auth.com/docs/concepts/database for the full schema.
 */

import { pgTable, uuid, varchar, timestamp, text, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: varchar("image", { length: 512 }),
  // Role field — maps to development_standards.roles[].role_id
  role: varchar("role", { length: 64 }).notNull().default("viewer"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: varchar("token", { length: 512 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  providerId: varchar("provider_id", { length: 64 }).notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const verifications = pgTable("verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// OAuth tokens table for third-party integrations
export const oauthTokens = pgTable("oauth_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  integrationId: varchar("integration_id", { length: 64 }).notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scope: text("scope"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
`;
  return {
    relativePath: "src/db/schema/auth.ts",
    content,
    specIds: ["development_standards"],
    generator: "schema-generator",
  };
}

function generateSchemaIndex(entities: DataEntity[]): GeneratedFile {
  const exports = entities
    .map((e) => `export * from "./${e.entity_id.replace(/^ent_/, "").replace(/_/g, "-")}.js";`)
    .join("\n");

  const content = `/**
 * Drizzle Schema Index
 * Re-exports all table definitions for use with db.select(), db.insert(), etc.
 */

export * from "./auth.js";
${exports}
`;
  return {
    relativePath: "src/db/schema/index.ts",
    content,
    specIds: ["development_standards"],
    generator: "schema-generator",
  };
}

function generateDbIndex(): GeneratedFile {
  const content = `/**
 * Drizzle Database Singleton
 * Implements spec section: development_standards (orm_preference: drizzle)
 *
 * Uses a module-level singleton to reuse the connection pool across
 * Next.js Server Component renders and Route Handlers.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is not set. " +
    "Add it to .env.local for local development, or configure the Railway Postgres plugin."
  );
}

// Singleton pattern — reuse the connection pool across hot-reload in development
const globalForDb = globalThis as unknown as { _pgClient?: ReturnType<typeof postgres> };

const pgClient = globalForDb._pgClient ?? postgres(connectionString);
if (process.env.NODE_ENV !== "production") globalForDb._pgClient = pgClient;

export const db = drizzle(pgClient, { schema });
export type DB = typeof db;

// Re-export schema for convenience
export * from "./schema/index.js";
`;
  return {
    relativePath: "src/db/index.ts",
    content,
    specIds: ["development_standards"],
    generator: "schema-generator",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}
