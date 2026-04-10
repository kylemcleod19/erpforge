/**
 * GET /api/uploads/:uploadId
 * Returns the processing status and extracted data for an upload.
 * Clients poll this at ~3s intervals until processingStatus = "complete" | "error".
 */
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { ok, apiError, notFound, serverError } from "@/lib/api";
import { childLogger } from "@/lib/logger";
import { db } from "@/db/index";
import { uploads } from "@/db/schema/index";

const log = childLogger("api/uploads/[uploadId]");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const session = await getSession();
  if (!session) return apiError("Unauthorized", 401);

  const { uploadId } = await params;

  try {
    const rows = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, uploadId))
      .limit(1);

    const upload = rows[0];
    if (!upload) return notFound("Upload");

    // Return only safe fields (no internal storagePath)
    return ok({
      id: upload.id,
      taskId: upload.taskId,
      uploadType: upload.uploadType,
      originalFilename: upload.originalFilename,
      fileSizeBytes: upload.fileSizeBytes,
      processingStatus: upload.processingStatus,
      extractedData: upload.extractedData,
      errorMessage: upload.errorMessage,
      createdAt: upload.createdAt,
      processedAt: upload.processedAt,
    });
  } catch (err) {
    log.error({ uploadId, err }, "failed to get upload");
    return serverError();
  }
}
