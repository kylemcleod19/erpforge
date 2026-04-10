/**
 * Org metadata — supplements better-auth's organization table.
 *
 * better-auth owns the organization, member, and invitation tables.
 * This table holds ERP Forge-specific metadata keyed by the same org ID.
 */
import { pgTable, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const orgMeta = pgTable("org_meta", {
  // Matches better-auth organization.id
  orgId: varchar("org_id", { length: 100 }).primaryKey(),

  // True for ephemeral demo orgs created via POST /api/demo
  isDemo: boolean("is_demo").notNull().default(false),

  // Null for real orgs; set to now()+24h for demo orgs
  demoExpiresAt: timestamp("demo_expires_at", { withTimezone: true }),
});

export type OrgMetaRow = typeof orgMeta.$inferSelect;
export type NewOrgMetaRow = typeof orgMeta.$inferInsert;
