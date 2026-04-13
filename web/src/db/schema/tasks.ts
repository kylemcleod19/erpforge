/**
 * Tasks — the core unit of work in the platform.
 *
 * Each task belongs to an org and can be assigned to a user.
 * The actionType determines which UI actions are shown on the task detail page.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "in_progress",
  "complete",
  "blocked",
]);

export const taskActionTypeEnum = pgEnum("task_action_type", [
  "interview",
  "upload_transcript",
  "upload_document",
  "reassign",
  "general",
]);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // better-auth organization.id
    orgId: varchar("org_id", { length: 100 }).notNull(),

    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),

    // Structured questions to answer — rendered as a numbered list, not embedded in description
    questions: jsonb("questions").$type<string[]>(),

    // Consultant-visible context notes — not shown to client users
    contextNotes: text("context_notes"),

    // References better-auth user.id (nullable = unassigned)
    assignedToId: text("assigned_to_id"),
    assignedById: text("assigned_by_id"),

    status: taskStatusEnum("status").notNull().default("open"),
    actionType: taskActionTypeEnum("action_type").notNull().default("general"),

    // When set, links this task to a CLI interview session in customers/<slug>/
    interviewSlug: varchar("interview_slug", { length: 100 }),

    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tasks_org_assignee_status_idx").on(t.orgId, t.assignedToId, t.status)]
);

export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;

/**
 * Task messages — in-task communication between users and consultants.
 */
export const taskMessages = pgTable("task_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull(),
  authorId: text("author_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TaskMessageRow = typeof taskMessages.$inferSelect;
export type NewTaskMessageRow = typeof taskMessages.$inferInsert;
