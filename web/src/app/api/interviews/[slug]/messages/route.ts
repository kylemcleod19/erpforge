/**
 * POST /api/interviews/:slug/messages
 * Sends a user message to the active interview agent and returns its reply.
 *
 * This is the main conversation endpoint. Each call delivers the user's
 * message to the running agent and blocks until the agent produces its
 * next reply (typically 1–10 seconds for a Claude API call).
 *
 * Body: { message: string }
 * Response: { ok: true, data: { reply, phase, done, specPath? } }
 *
 * Errors:
 *   404 — no active worker for this slug (server restarted or session expired)
 *         → client should POST to /api/interviews to resume
 *   408 — agent timed out (Claude API took too long)
 *   400 — agent not waiting for input (session in a non-interactive phase)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { sendMessage } from "@/lib/interview-service";
import { ok, apiError, notFound, serverError } from "@/lib/api";
import { childLogger } from "@/lib/logger";

const log = childLogger("api/interviews/[slug]/messages");

const SendMessageBody = z.object({
  message: z.string().min(1).max(10_000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }

  const parsed = SendMessageBody.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? "Invalid request");
  }

  const { message } = parsed.data;
  log.debug({ slug }, "Sending user message");

  try {
    const result = await sendMessage(slug, message);
    return ok(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes("No active session")) {
      return notFound("Active interview session");
    }
    if (msg.includes("not waiting for input")) {
      return apiError(msg, 400);
    }
    if (msg.includes("Timeout")) {
      return apiError("Agent response timed out — try again", 408);
    }

    log.error({ slug, err }, "Failed to send message");
    return serverError(msg);
  }
}
