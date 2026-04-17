/**
 * ERP Forge — Interviewer Microservice
 *
 * Standalone Express server wrapping the InterviewAgent.
 * Extracted from web/src/lib/interview-service.ts — same deferred-Promise
 * bridge, same auto-approve review logic, now served over HTTP.
 *
 * API:
 *   POST   /sessions                  — start or resume session
 *   GET    /sessions/:slug            — session state (from disk)
 *   POST   /sessions/:slug/messages   — send user message, get agent reply
 *   DELETE /sessions/:slug            — terminate session
 *   GET    /health                    — liveness check
 */

import express, { type Request, type Response } from "express";
import * as readline from "readline";
import Anthropic from "@anthropic-ai/sdk";
import { runIntake } from "../../interviewer/phases/intake";
import { routeModules } from "../../interviewer/phases/router";
import { runAllModules } from "../../interviewer/phases/module-runner";
import { runGapAnalysis } from "../../interviewer/phases/researcher";
import { runHumanReview } from "../../interviewer/phases/reviewer";
import { compileSpec } from "../../interviewer/phases/compiler";
import {
  createSession,
  loadSession,
  ensureCustomerDir,
} from "../../interviewer/session";
import type { InterviewSession, InterviewPhase } from "../../interviewer/types";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TurnResult {
  reply: string;
  phase: InterviewPhase;
  done: boolean;
  specPath?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
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
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`Timeout waiting for ${label}`)), ms)
    ),
  ]);
}

// ─── Worker state ─────────────────────────────────────────────────────────────

interface SessionWorker {
  session: InterviewSession;
  agentWaiting: Deferred<TurnResult> | null;
  userInput: Deferred<string> | null;
  runPromise: Promise<void>;
}

const workers = new Map<string, SessionWorker>();

// ─── Message handler factory ──────────────────────────────────────────────────

function makeWebMessageHandler(
  worker: SessionWorker
): (role: "assistant" | "user", content: string) => Promise<string> {
  return async (role, content) => {
    if (role !== "assistant") return "";

    const userInputDeferred = deferred<string>();
    worker.userInput = userInputDeferred;

    const waiting = worker.agentWaiting;
    worker.agentWaiting = null;
    waiting?.resolve({
      reply: content,
      phase: worker.session.current_phase,
      done: false,
    });

    return withTimeout(userInputDeferred.promise, 600_000, "user input");
  };
}

function makeAutoReviewRl(flagCount: number): readline.Interface {
  let calls = 0;
  return {
    question: (_prompt: string, callback: (answer: string) => void) => {
      callback(calls < flagCount ? "s" : "");
      calls++;
    },
    close: () => {},
  } as unknown as readline.Interface;
}

// ─── Worker runner ────────────────────────────────────────────────────────────

async function runInterview(worker: SessionWorker): Promise<void> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
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
          console.debug(JSON.stringify({ slug: session.customer_slug, msg }))
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
    console.error(
      JSON.stringify({ slug: session.customer_slug, err: String(err) }),
      "Interview worker error"
    );
    worker.agentWaiting?.reject(err);
    worker.userInput?.reject(err);
    throw err;
  }

  const finalReply = session.spec_path
    ? "Your ERP specification is complete! The spec has been compiled and is ready for the next step."
    : "The interview is complete. We're finalising your specification now.";

  worker.agentWaiting?.resolve({
    reply: finalReply,
    phase: "complete",
    done: true,
    specPath: session.spec_path ?? undefined,
  });
}

// ─── Session management ───────────────────────────────────────────────────────

async function startOrResumeSession(slug: string): Promise<TurnResult> {
  const existing = workers.get(slug);
  if (existing) {
    const existingSession = loadSession(slug);
    const history = (existingSession?.messages ?? []).flatMap((m) => {
      const content =
        typeof m.content === "string"
          ? m.content
          : m.content
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

  const openingMessagePromise = worker.agentWaiting!.promise;

  worker.runPromise = runInterview(worker).finally(() => {
    workers.delete(slug);
    console.info(JSON.stringify({ slug, event: "worker_cleaned_up" }));
  });

  const result = await withTimeout(openingMessagePromise, 60_000, "agent opening message");
  console.info(JSON.stringify({ slug, phase: result.phase, event: "interview.started" }));
  return result;
}

async function deliverMessage(slug: string, message: string): Promise<TurnResult> {
  const worker = workers.get(slug);
  if (!worker) {
    throw new Error(`No active session for ${slug}. POST to /sessions to resume.`);
  }
  if (!worker.userInput) {
    throw new Error(
      `Session ${slug} is not waiting for input (phase: ${worker.session.current_phase})`
    );
  }

  worker.agentWaiting = deferred<TurnResult>();
  worker.userInput.resolve(message);
  worker.userInput = null;

  return withTimeout(worker.agentWaiting.promise, 150_000, "agent reply");
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get(["/health", "/api/health"], (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "interviewer", ts: new Date().toISOString() });
});

// POST /sessions — start or resume
app.post("/sessions", (req: Request, res: Response) => {
  const { slug } = req.body as { slug?: string };
  if (!slug || typeof slug !== "string") {
    res.status(400).json({ error: "slug is required" });
    return;
  }
  startOrResumeSession(slug)
    .then((result) => res.json(result))
    .catch((err: unknown) => {
      console.error(JSON.stringify({ err: String(err), slug }));
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    });
});

// GET /sessions/:slug — session state (disk read, no worker required)
app.get("/sessions/:slug", (req: Request, res: Response) => {
  const { slug } = req.params;
  const session = loadSession(slug);
  if (!session) {
    res.status(404).json({ error: `No session found for ${slug}` });
    return;
  }
  res.json({
    slug,
    sessionId: session.session_id,
    phase: session.current_phase,
    completedModules: session.completed_modules,
    reviewFlagsCount: session.review_flags.length,
    specPath: session.spec_path,
    workerActive: workers.has(slug),
  });
});

// POST /sessions/:slug/messages — deliver user message, return agent reply
app.post("/sessions/:slug/messages", (req: Request, res: Response) => {
  const { slug } = req.params;
  const { message } = req.body as { message?: string };
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }
  deliverMessage(slug, message)
    .then((result) => res.json(result))
    .catch((err: unknown) => {
      console.error(JSON.stringify({ err: String(err), slug }));
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    });
});

// DELETE /sessions/:slug — terminate session
app.delete("/sessions/:slug", (req: Request, res: Response) => {
  const { slug } = req.params;
  const worker = workers.get(slug);
  if (worker) {
    worker.agentWaiting?.reject(new Error("Session terminated"));
    worker.userInput?.reject(new Error("Session terminated"));
    workers.delete(slug);
  }
  res.json({ deleted: true, slug });
});

app.listen(PORT, () => {
  console.info(JSON.stringify({ event: "server_started", service: "interviewer", port: PORT }));
});
