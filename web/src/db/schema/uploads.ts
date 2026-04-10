/**
 * Uploads — files attached to tasks (transcripts and supporting documents).
 *
 * Files are stored on the Railway volume. Claude processes them in the background
 * to extract structured insights from meeting transcripts and uploaded documents.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

export const uploadTypeEnum = pgEnum("upload_type", ["transcript", "document"]);

export const uploadProcessingStatusEnum = pgEnum("upload_processing_status", [
  "pending",
  "processing",
  "complete",
  "error",
]);

export const uploads = pgTable("uploads", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull(),
  orgId: varchar("org_id", { length: 100 }).notNull(),
  uploadedById: text("uploaded_by_id").notNull(),

  uploadType: uploadTypeEnum("upload_type").notNull(),
  originalFilename: varchar("original_filename", { length: 500 }).notNull(),

  // Path relative to config.uploadsDir
  storagePath: varchar("storage_path", { length: 1000 }).notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  mimeType: varchar("mime_type", { length: 100 }),

  processingStatus: uploadProcessingStatusEnum("processing_status")
    .notNull()
    .default("pending"),

  // Claude's structured extraction output: { summary, openQuestions, actionItems, followUpNeeded }
  extractedData: jsonb("extracted_data"),
  errorMessage: text("error_message"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export type UploadRow = typeof uploads.$inferSelect;
export type NewUploadRow = typeof uploads.$inferInsert;

export interface ExtractedUploadData {
  summary: string;
  openQuestions: string[];
  actionItems: string[];
  followUpNeeded: boolean;
}
