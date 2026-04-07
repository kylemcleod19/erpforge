CREATE TYPE "public"."build_status" AS ENUM('queued', 'running', 'complete', 'error');--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"session_id" varchar(100) NOT NULL,
	"phase" varchar(50) DEFAULT 'intake' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"spec_version" varchar(20),
	"review_flags_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "interview_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "build_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"spec_version" varchar(20) NOT NULL,
	"status" "build_status" DEFAULT 'queued' NOT NULL,
	"current_phase" varchar(50),
	"files_created" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
