CREATE TYPE "public"."task_action_type" AS ENUM('interview', 'upload_transcript', 'upload_document', 'reassign', 'general');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'in_progress', 'complete', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."upload_processing_status" AS ENUM('pending', 'processing', 'complete', 'error');--> statement-breakpoint
CREATE TYPE "public"."upload_type" AS ENUM('transcript', 'document');--> statement-breakpoint
CREATE TABLE "task_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"context_notes" text,
	"assigned_to_id" text,
	"assigned_by_id" text,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"action_type" "task_action_type" DEFAULT 'general' NOT NULL,
	"interview_slug" varchar(100),
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"org_id" varchar(100) NOT NULL,
	"uploaded_by_id" text NOT NULL,
	"upload_type" "upload_type" NOT NULL,
	"original_filename" varchar(500) NOT NULL,
	"storage_path" varchar(1000) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"mime_type" varchar(100),
	"processing_status" "upload_processing_status" DEFAULT 'pending' NOT NULL,
	"extracted_data" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "org_meta" (
	"org_id" varchar(100) PRIMARY KEY NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"demo_expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "tasks_org_assignee_status_idx" ON "tasks" USING btree ("org_id","assigned_to_id","status");