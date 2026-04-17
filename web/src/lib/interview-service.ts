/**
 * Interview Service — HTTP client
 *
 * Delegates all interview work to the Interviewer microservice
 * (services/interviewer/server.ts). The web server no longer runs the
 * InterviewAgent in-process; it is an HTTP orchestrator only.
 *
 * Function signatures are identical to the old in-process bridge so callers
 * (API route handlers) require no changes.
 */

import { config } from "./config";
import { childLogger } from "./logger";
import type { InterviewPhase } from "../../../interviewer/types";

const log = childLogger("interview-service");

// ─── Types (re-exported for route handlers) ───────────────────────────────────

export interface TurnResult {
  reply: string;
  phase: InterviewPhase;
  done: boolean;
  specPath?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface SessionState {
  slug: string;
  sessionId: string;
  phase: InterviewPhase;
  completedModules: string[];
  reviewFlagsCount: number;
  specPath: string | null;
  workerActive?: boolean;
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function serviceRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${config.interviewerServiceUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const json = (await res.json()) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(
      (json as { error?: string }).error ?? `Interviewer service error: ${res.status}`
    );
  }
  return json as T;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a new interview session (or resumes an existing one).
 * Returns the agent's opening message.
 */
export async function startSession(slug: string): Promise<TurnResult> {
  const result = await serviceRequest<TurnResult>("POST", "/sessions", { slug });
  log.info({ slug, phase: result.phase }, "interview.started");
  return result;
}

/**
 * Sends the user's message to the agent and returns the agent's next reply.
 */
export async function sendMessage(
  slug: string,
  message: string
): Promise<TurnResult> {
  const result = await serviceRequest<TurnResult>(
    "POST",
    `/sessions/${encodeURIComponent(slug)}/messages`,
    { message }
  );
  if (result.done) {
    log.info({ slug, specPath: result.specPath }, "interview.spec_compiled");
  }
  return result;
}

/**
 * Returns the current session state. Returns null if no session exists.
 */
export async function getSessionState(slug: string): Promise<SessionState | null> {
  try {
    return await serviceRequest<SessionState>(
      "GET",
      `/sessions/${encodeURIComponent(slug)}`
    );
  } catch (err) {
    // 404 → no session
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}
