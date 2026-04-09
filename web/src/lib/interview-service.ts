/**
 * Interview Service
 *
 * Wraps the CLI InterviewAgent for use in a web request/response context.
 * The interviewer agent is designed as a long-running interactive loop
 * (readline-based). This service bridges that loop to HTTP by running the
 * agent as a background async task and synchronising turns with Promises.
 *
 * HOW IT WORKS
 * ────────────
 * Each active session has a "worker" — a long-running Promise executing the
 * full interview (intake → modules → gap analysis → review → compilation).
 * The worker blocks at each assistant turn waiting for user input.
 *
 * Two deferred Promises synchronise the HTTP handler and the worker:
 *
 *   agentWaiting  — resolves when the agent has emitted a reply and is
 *                   blocking for the next user message. The HTTP handler
 *                   awaits this to get the text to return to the client.
 *
 *   userInput     — resolves when the HTTP handler receives a user message.
 *                   The worker awaits this to get the text to feed back in.
 *
 * Per-turn lifecycle:
 *   1. POST /messages arrives
 *   2. New agentWaiting deferred is set on the worker
 *   3. userInput deferred is resolved with the user's message
 *   4. Worker resumes → Claude API call → next reply
 *   5. onMessage("assistant", reply) is called inside the worker
 *   6. agentWaiting is resolved with the reply
 *   7. HTTP handler receives the reply → returns response
 *   8. Worker blocks on new userInput deferred
 *
 * REVIEW PHASE
 * ────────────
 * The review phase (runHumanReview) is operator-only and uses readline
 * directly. A mock readline auto-approves all flags so the agent can
 * continue to compilation without blocking on operator input.
 * A proper operator review UI can be added later.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import { runIntake } from "../../../interviewer/phases/intake";
import { routeModules } from "../../../interviewer/phases/router";
import { runAllModules } from "../../../interviewer/phases/module-runner";
import { runGapAnalysis } from "../../../interviewer/phases/researcher";
import { runHumanReview } from "../../../interviewer/phases/reviewer";
import { compileSpec } from "../../../interviewer/phases/compiler";
import {
  createSession,
  loadSession,
  ensureCustomerDir,
} from "../../../interviewer/session";
import type {
  InterviewSession,
  InterviewPhase,
} from "../../../interviewer/types";
import { config } from "./config";
import { childLogger } from "./logger";
import { sendAlert } from "./alert";

const log = childLogger("interview-service");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TurnResult {
  reply: string;
  phase: InterviewPhase;
  done: boolean;
  specPath?: string;
  /** Populated on resume — full prior conversation so the UI can restore history. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface SessionState {
  slug: string;
  sessionId: string;
  phase: InterviewPhase;
  completedModules: string[];
  reviewFlagsCount: number;
  specPath: string | null;
}

// ─── Deferred helper ──────────────────────────────────────────────────────────

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout waiting for ${label}`)), ms)
    ),
  ]);
}

// ─── Worker state ─────────────────────────────────────────────────────────────

interface SessionWorker {
  session: InterviewSession;
  // Resolves when the agent has emitted a reply and is waiting for user input.
  agentWaiting: Deferred<TurnResult> | null;
  // Resolves to deliver the user's message to the agent.
  userInput: Deferred<string> | null;
  // The background run promise — resolves when the full interview is done.
  runPromise: Promise<void>;
}

// In-memory registry of active sessions.
// Lost on server restart — callers use GET /api/interviews/:slug to detect
// a missing worker and re-POST to /api/interviews to restart from the saved session.
const workers = new Map<string, SessionWorker>();

// ─── Message handler factory ──────────────────────────────────────────────────

/**
 * Returns an onMessage handler that bridges the agent's turn loop to HTTP.
 * Called once per phase that needs customer interaction (intake, modules, gap_analysis).
 */
function makeWebMessageHandler(
  worker: SessionWorker
): (role: "assistant" | "user", content: string) => Promise<string> {
  return async (role, content) => {
    if (role !== "assistant") return "";

    // 1. Set up the deferred for the user's next message.
    const userInputDeferred = deferred<string>();
    worker.userInput = userInputDeferred;

    // 2. Resolve the HTTP handler's wait with this reply.
    const waiting = worker.agentWaiting;
    worker.agentWaiting = null;
    waiting?.resolve({
      reply: content,
      phase: worker.session.current_phase,
      done: false,
    });

    // 3. Block the agent until the user sends a message (10-min timeout).
    return withTimeout(userInputDeferred.promise, 600_000, "user input");
  };
}

/**
 * A mock readline interface that auto-approves all operator review flags.
 * Each question gets either "s" (skip) or "" (empty for free-text prompts).
 */
function makeAutoReviewRl(flagCount: number): readline.Interface {
  let calls = 0;
  return {
    question: (_prompt: string, callback: (answer: string) => void) => {
      // The first flagCount calls are for individual flags → skip each.
      // The final call is for free-form notes → send empty to skip.
      callback(calls < flagCount ? "s" : "");
      calls++;
    },
    close: () => {},
    // readline.Interface has many other members; cast through unknown.
  } as unknown as readline.Interface;
}

// ─── Worker runner ────────────────────────────────────────────────────────────

async function runInterview(worker: SessionWorker): Promise<void> {
  const apiKey = config.anthropicApiKey;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const client = new Anthropic({ apiKey });
  const onMessage = makeWebMessageHandler(worker);
  let session = worker.session;

  try {
    switch (session.current_phase) {
      case "intake":
        session = await runIntake(session, client, onMessage);
        worker.session = session;
        // eslint-disable-next-line no-fallthrough
      case "routing":
        session = await routeModules(session, client);
        worker.session = session;
        // eslint-disable-next-line no-fallthrough
      case "modules":
        session = await runAllModules(session, client, onMessage, (msg) =>
          log.debug({ slug: session.customer_slug }, msg)
        );
        worker.session = session;
        // eslint-disable-next-line no-fallthrough
      case "gap_analysis":
        session = await runGapAnalysis(session, client, onMessage);
        worker.session = session;
        // eslint-disable-next-line no-fallthrough
      case "review":
        session = await runHumanReview(
          session,
          makeAutoReviewRl(session.review_flags.length)
        );
        worker.session = session;
        // eslint-disable-next-line no-fallthrough
      case "compilation":
        session = await compileSpec(session, client);
        worker.session = session;
        break;
      case "complete":
        break;
    }
  } catch (err) {
    log.error({ slug: session.customer_slug, err }, "Interview worker error");
    await sendAlert("Interview worker error", {
      slug: session.customer_slug,
      error: String(err),
    });
    // Unblock any waiting HTTP handler with the error.
    worker.agentWaiting?.reject(err);
    worker.userInput?.reject(err);
    throw err;
  }

  // Interview complete — unblock any HTTP handler still waiting for a reply.
  const finalReply =
    session.spec_path
      ? "Your ERP specification is complete! The spec has been compiled and is ready for the next step."
      : "The interview is complete. We're finalising your specification now.";

  worker.agentWaiting?.resolve({
    reply: finalReply,
    phase: "complete",
    done: true,
    specPath: session.spec_path ?? undefined,
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a new interview session (or resumes an existing one from disk).
 * Starts the worker in the background and returns the agent's opening message.
 */
export async function startSession(slug: string): Promise<TurnResult> {
  // If a worker already exists (user navigated away and back), resume gracefully.
  // The worker is still blocked on userInput — just return the prior conversation
  // history so the UI can repopulate and the user can continue sending messages.
  const existing = workers.get(slug);
  if (existing) {
    const existingSession = loadSession(slug);
    const history = (existingSession?.messages ?? []).flatMap((m) => {
      const content = typeof m.content === "string" ? m.content : m.content
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return content ? [{ role: m.role as "user" | "assistant", content }] : [];
    });
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
    return {
      reply: lastAssistant?.content ?? "Welcome back — please continue.",
      phase: existing.session.current_phase,
      done: existing.session.current_phase === "complete",
      history,
    };
  }

  ensureCustomerDir(slug);

  // Load from disk if available, otherwise create fresh.
  const existingSession = loadSession(slug);
  const session = existingSession ?? createSession(slug);

  if (session.current_phase === "complete") {
    return {
      reply: "This interview is already complete.",
      phase: "complete",
      done: true,
      specPath: session.spec_path ?? undefined,
    };
  }

  const worker: SessionWorker = {
    session,
    agentWaiting: deferred<TurnResult>(),
    userInput: null,
    runPromise: Promise.resolve(),
  };
  workers.set(slug, worker);

  // Start the interview runner in the background. Clean up when done.
  worker.runPromise = runInterview(worker).finally(() => {
    workers.delete(slug);
    log.info({ slug }, "Worker cleaned up");
  });

  // Wait for the agent to emit its first message (60s timeout).
  const result = await withTimeout(
    worker.agentWaiting!.promise,
    60_000,
    "agent opening message"
  );

  log.info({ slug, phase: result.phase }, "interview.started");
  return result;
}

/**
 * Sends the user's message to the agent and returns the agent's next reply.
 * Throws if no active worker exists for this slug.
 */
export async function sendMessage(
  slug: string,
  message: string
): Promise<TurnResult> {
  const worker = workers.get(slug);
  if (!worker) {
    throw new Error(
      `No active session for ${slug}. The server may have restarted — POST to /api/interviews to resume.`
    );
  }
  if (!worker.userInput) {
    throw new Error(
      `Session ${slug} is not waiting for input (phase: ${worker.session.current_phase})`
    );
  }

  // Set up the next agentWaiting BEFORE releasing the agent (it may respond fast).
  worker.agentWaiting = deferred<TurnResult>();

  // Deliver the user's message to the agent.
  worker.userInput.resolve(message);
  worker.userInput = null;

  log.debug({ slug, phase: worker.session.current_phase }, "interview.message");

  // Wait for agent's next reply (2-min Claude API call timeout + buffer).
  const result = await withTimeout(
    worker.agentWaiting.promise,
    150_000,
    "agent reply"
  );

  if (result.done) {
    log.info({ slug, specPath: result.specPath }, "interview.spec_compiled");
  }

  return result;
}

/**
 * Returns the current state of a session (read from disk, no worker needed).
 * Returns null if no session file exists.
 */
export function getSessionState(slug: string): SessionState | null {
  const session = loadSession(slug);
  if (!session) return null;

  const hasActiveWorker = workers.has(slug);

  return {
    slug,
    sessionId: session.session_id,
    phase: session.current_phase,
    completedModules: session.completed_modules,
    reviewFlagsCount: session.review_flags.length,
    specPath: session.spec_path,
    // Callers can check workerActive to know if sendMessage will succeed.
    ...{ workerActive: hasActiveWorker },
  };
}
