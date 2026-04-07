/**
 * Interview sessions audit log.
 *
 * One row per customer interview session. Written to when a session is created,
 * updated on each phase transition, and completed when the spec is compiled.
 * This is an append-friendly audit log — the actual session state lives in
 * customers/<slug>/session.json on the Railway volume.
 */
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

export const interviewSessions = pgTable("interview_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Customer identifier — matches the directory name in customers/<slug>/
  slug: varchar("slug", { length: 100 }).notNull(),

  // UUID from InterviewSession.session_id (set by the interviewer agent)
  sessionId: varchar("session_id", { length: 100 }).notNull().unique(),

  // Current interview phase at the time of last write
  phase: varchar("phase", { length: 50 }).notNull().default("intake"),

  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  // Set when the spec is compiled (e.g. "1.0.0")
  specVersion: varchar("spec_version", { length: 20 }),

  // How many review flags were raised during the interview
  reviewFlagsCount: integer("review_flags_count").notNull().default(0),
});

export type InterviewSessionRow = typeof interviewSessions.$inferSelect;
export type NewInterviewSessionRow = typeof interviewSessions.$inferInsert;
