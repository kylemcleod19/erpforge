/**
 * Build jobs audit log.
 *
 * One row per dev-agent build invocation. Tracks status and progress so the
 * GET /api/builds/:slug endpoint can report build state without holding an
 * open HTTP connection. The detailed build state lives in
 * customers/<slug>/dev-session.json on the Railway volume.
 */
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  text,
  pgEnum,
} from "drizzle-orm/pg-core";

export const buildStatusEnum = pgEnum("build_status", [
  "queued",
  "running",
  "complete",
  "error",
]);

export const buildJobs = pgTable("build_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Customer identifier
  slug: varchar("slug", { length: 100 }).notNull(),

  // Spec version this build was triggered against (e.g. "1.0.0")
  specVersion: varchar("spec_version", { length: 20 }).notNull(),

  status: buildStatusEnum("status").notNull().default("queued"),

  // Which dev-agent phase is currently running (scaffold, database, api, …)
  currentPhase: varchar("current_phase", { length: 50 }),

  // Running count of files written so far
  filesCreated: integer("files_created").notNull().default(0),

  // Set when status = "error"
  errorMessage: text("error_message"),

  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type BuildJobRow = typeof buildJobs.$inferSelect;
export type NewBuildJobRow = typeof buildJobs.$inferInsert;
