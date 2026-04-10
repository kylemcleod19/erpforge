/**
 * POST /api/tasks/:taskId/uploads
 * Accepts a multipart file upload, writes it to disk, and kicks off AI processing.
 */
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import * as path from "path";
import * as fs from "fs";
import { getSession } from "@/lib/session";
import { getTask } from "@/lib/task-service";
import { ensureUploadDir, processUpload } from "@/lib/upload-service";
import { ok, apiError, notFound, serverError } from "@/lib/api";
import { childLogger } from "@/lib/logger";
import { config } from "@/lib/config";
import { db } from "@/db/index";
import { uploads } from "@/db/schema/index";

const log = childLogger("api/tasks/[taskId]/uploads");

const ALLOWED_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXTENSIONS = new Set([".txt", ".md", ".pdf", ".doc", ".docx"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await getSession();
  if (!session) return apiError("Unauthorized", 401);

  const { taskId } = await params;
  const user = session.user as typeof session.user & { role?: string };

  const task = await getTask(taskId, session.user.id, user.role ?? "client_user");
  if (!task) return notFound("Task");

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return apiError("Invalid multipart form data");
  }

  const file = formData.get("file");
  const uploadType = formData.get("uploadType");

  if (!(file instanceof File)) return apiError("'file' field is required");
  if (uploadType !== "transcript" && uploadType !== "document") {
    return apiError("'uploadType' must be 'transcript' or 'document'");
  }

  // Validate file size
  if (file.size > config.maxUploadBytes) {
    return apiError(
      `File too large — maximum ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB`
    );
  }

  // Validate file type
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_TYPES.has(file.type)) {
    return apiError("Unsupported file type — please upload a .txt, .md, .pdf, .doc, or .docx file");
  }

  try {
    const uploadId = randomUUID();
    const filename = `${uploadId}${ext}`;
    const dir = ensureUploadDir(task.orgId, taskId);
    const absPath = path.join(dir, filename);
    // storagePath is relative to config.uploadsDir
    const storagePath = `${task.orgId}/${taskId}/${filename}`;

    // Write to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(absPath, buffer);

    // Insert uploads row
    await db.insert(uploads).values({
      id: uploadId,
      taskId,
      orgId: task.orgId,
      uploadedById: session.user.id,
      uploadType,
      originalFilename: file.name,
      storagePath,
      fileSizeBytes: file.size,
      mimeType: file.type || undefined,
      processingStatus: "pending",
    });

    log.info({ uploadId, taskId, uploadType, filename: file.name }, "upload received");

    // Fire and forget
    void processUpload(uploadId);

    return ok({ uploadId, processingStatus: "pending" });
  } catch (err) {
    log.error({ taskId, err }, "upload failed");
    return serverError();
  }
}
