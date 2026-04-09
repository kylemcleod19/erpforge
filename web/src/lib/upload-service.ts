/**
 * Upload service — background AI processing for uploaded files.
 *
 * Mirrors build-service.ts: fire-and-forget background job with in-memory
 * status map. Clients poll GET /api/uploads/:id until processingStatus = "complete".
 *
 * HOW IT WORKS
 * ────────────
 * 1. Route handler writes the file to disk and inserts an uploads row (pending)
 * 2. Route handler calls processUpload(uploadId) — fire and forget
 * 3. processUpload reads the file, loads task context, calls Claude
 * 4. Claude extracts: summary, openQuestions, actionItems, followUpNeeded
 * 5. uploads row updated to complete with extractedData
 * 6. If followUpNeeded: a new interview task is created automatically
 */

import * as fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import { uploads, tasks } from "@/db/schema/index";
import { config } from "./config";
import { childLogger } from "./logger";
import { sendAlert } from "./alert";
import type { ExtractedUploadData } from "@/db/schema/uploads";

const log = childLogger("upload-service");

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

export function uploadStorageDir(orgId: string, taskId: string): string {
  return `${config.uploadsDir}/${orgId}/${taskId}`;
}

export function ensureUploadDir(orgId: string, taskId: string): string {
  const dir = uploadStorageDir(orgId, taskId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// Background processor
// ---------------------------------------------------------------------------

const EXTRACTION_SYSTEM = `You are an expert ERP consultant. Your job is to read a file uploaded by a client and extract structured insights relevant to an ERP implementation project.

Respond with a single JSON object only — no markdown, no explanation. Schema:
{
  "summary": "2-3 sentence summary of the content",
  "openQuestions": ["question 1", "question 2"],
  "actionItems": ["action 1", "action 2"],
  "followUpNeeded": true | false
}

followUpNeeded should be true if the document raises significant unanswered questions that an AI interview session would help resolve.`;

export async function processUpload(uploadId: string): Promise<void> {
  const apiKey = config.anthropicApiKey;
  if (!apiKey) {
    log.warn({ uploadId }, "ANTHROPIC_API_KEY not set — skipping AI processing");
    await db
      .update(uploads)
      .set({ processingStatus: "error", errorMessage: "ANTHROPIC_API_KEY not configured" })
      .where(eq(uploads.id, uploadId));
    return;
  }

  // Load upload row
  const uploadRows = await db.select().from(uploads).where(eq(uploads.id, uploadId)).limit(1);
  const upload = uploadRows[0];
  if (!upload) {
    log.error({ uploadId }, "upload row not found");
    return;
  }

  // Load task context
  const taskRows = await db.select().from(tasks).where(eq(tasks.id, upload.taskId)).limit(1);
  const task = taskRows[0];

  // Mark as processing
  await db
    .update(uploads)
    .set({ processingStatus: "processing" })
    .where(eq(uploads.id, uploadId));

  log.info({ uploadId, taskId: upload.taskId, uploadType: upload.uploadType }, "processing upload");

  try {
    const filePath = `${config.uploadsDir}/${upload.storagePath}`;
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

    const fileBuffer = fs.readFileSync(filePath);
    const isPdf = upload.mimeType === "application/pdf" || upload.originalFilename.endsWith(".pdf");

    const client = new Anthropic({ apiKey });

    const taskContext = task
      ? `Task: ${task.title}\n${task.description ? `Description: ${task.description}\n` : ""}${task.contextNotes ? `Context: ${task.contextNotes}\n` : ""}`
      : "No task context available.";

    const uploadTypeLabel =
      upload.uploadType === "transcript" ? "meeting transcript" : "supporting document";

    let messageContent: Anthropic.MessageParam["content"];

    if (isPdf) {
      messageContent = [
        {
          type: "text",
          text: `Task context:\n${taskContext}\n\nPlease analyze the attached ${uploadTypeLabel} and extract structured insights.`,
        },
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: fileBuffer.toString("base64"),
          },
        } as Anthropic.DocumentBlockParam,
      ];
    } else {
      // Plain text / markdown / other readable formats
      const textContent = fileBuffer.toString("utf-8");
      messageContent = `Task context:\n${taskContext}\n\n${uploadTypeLabel.charAt(0).toUpperCase() + uploadTypeLabel.slice(1)} content:\n\n${textContent}`;
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001", // Fast + cheap for extraction
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: "user", content: messageContent }],
    });

    const rawText =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    // Parse JSON — strip any accidental markdown fences
    const jsonStr = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const extracted: ExtractedUploadData = JSON.parse(jsonStr);

    // Save results
    await db
      .update(uploads)
      .set({
        processingStatus: "complete",
        extractedData: extracted,
        processedAt: new Date(),
      })
      .where(eq(uploads.id, uploadId));

    log.info(
      { uploadId, followUpNeeded: extracted.followUpNeeded },
      "upload processing complete"
    );

    // Auto-create follow-up interview task if needed
    if (extracted.followUpNeeded && task) {
      await db.insert(tasks).values({
        orgId: upload.orgId,
        title: `Follow-up interview: ${task.title}`,
        description: `Automatically created after reviewing uploaded ${uploadTypeLabel}. Open questions:\n\n${extracted.openQuestions.map((q) => `• ${q}`).join("\n")}`,
        actionType: "interview",
        status: "open",
        assignedToId: task.assignedToId,
        assignedById: task.assignedById,
      });
      log.info({ taskId: task.id }, "auto-created follow-up interview task");
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error({ uploadId, err }, "upload processing failed");
    await db
      .update(uploads)
      .set({ processingStatus: "error", errorMessage })
      .where(eq(uploads.id, uploadId));
    await sendAlert("Upload processing failed", { uploadId, errorMessage });
  }
}
