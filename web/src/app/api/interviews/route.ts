/**
 * POST /api/interviews
 * Creates a new interview session (or resumes from disk if one exists).
 * Returns the agent's opening message so the frontend can render it immediately.
 *
 * Body: { slug: string }
 * Response: { ok: true, data: { slug, reply, phase, done } }
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { startSession } from "@/lib/interview-service";
import { ok, apiError, serverError } from "@/lib/api";
import { childLogger } from "@/lib/logger";

const log = childLogger("api/interviews");

const CreateSessionBody = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase letters, numbers, and hyphens"
    ),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  const parsed = CreateSessionBody.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? "Invalid request");
  }

  const { slug } = parsed.data;
  log.info({ slug }, "Creating interview session");

  try {
    const result = await startSession(slug);
    return ok({ slug, ...result });
  } catch (err) {
    log.error({ slug, err }, "Failed to start session");
    return serverError(err instanceof Error ? err.message : "Failed to start session");
  }
}
