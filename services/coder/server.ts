/**
 * ERP Forge — Coder Microservice
 *
 * Standalone Express server wrapping the DevAgent.
 * Extracted from web/src/lib/build-service.ts — same mock-readline bridge,
 * same auto-approve phase-gate logic, now served over HTTP.
 *
 * API:
 *   POST   /builds                     — start build
 *   GET    /builds/:slug               — poll status
 *   POST   /builds/:slug/continue      — advance past a phase gate (manual override)
 *   DELETE /builds/:slug               — cancel build
 *   GET    /health                     — liveness check
 */

import express, { type Request, type Response } from "express";
import * as readline from "readline";
import * as fs from "fs";
import { DevAgent } from "../../dev-agent/agent";
import {
  devSessionPath,
  buildManifestPath,
  specPath,
} from "../../dev-agent/spec-manager";
import type { DevAgentSession } from "../../dev-agent/types";

const PORT = parseInt(process.env.PORT ?? "3002", 10);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

type BuildStatusValue = "queued" | "running" | "complete" | "error";

interface BuildStatus {
  slug: string;
  specVersion: string;
  status: BuildStatusValue;
  currentPhase: string;
  filesCreated: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

// ─── In-memory registries ─────────────────────────────────────────────────────

const builds = new Map<string, BuildStatus>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countManifestFiles(slug: string): number {
  try {
    const manifestPath = buildManifestPath(slug);
    if (!fs.existsSync(manifestPath)) return 0;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
      entries?: Array<{ generated_files?: string[] }>;
    };
    return (manifest.entries ?? []).flatMap((e) => e.generated_files ?? []).length;
  } catch {
    return 0;
  }
}

/**
 * Mock readline that auto-approves all DevAgent prompts and tracks phase
 * transitions in the in-memory builds map.
 */
function makeAutoBuildRl(slug: string): readline.Interface {
  return {
    question: (prompt: string, callback: (answer: string) => void) => {
      const phaseMatch = prompt.match(/\[Phase (\w+) complete\]/i);
      if (phaseMatch) {
        const completedPhase = phaseMatch[1];
        console.info(
          JSON.stringify({ slug, phase: completedPhase, event: "build.phase_complete" })
        );
        const current = builds.get(slug);
        if (current) {
          builds.set(slug, {
            ...current,
            currentPhase: completedPhase,
            filesCreated: countManifestFiles(slug),
          });
        }
        callback("continue");
        return;
      }
      callback("y");
    },
    close: () => {},
  } as unknown as readline.Interface;
}

async function runBuild(slug: string): Promise<void> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");
  const rl = makeAutoBuildRl(slug);
  const agent = DevAgent.init(ANTHROPIC_API_KEY, rl, slug);
  try {
    await agent.run();
  } finally {
    rl.close();
  }
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "coder", ts: new Date().toISOString() });
});

// POST /builds — start a new build
app.post("/builds", (req: Request, res: Response) => {
  const { slug } = req.body as { slug?: string };
  if (!slug || typeof slug !== "string") {
    res.status(400).json({ error: "slug is required" });
    return;
  }

  const existing = builds.get(slug);
  if (existing && existing.status === "running") {
    res.status(409).json({
      error: `A build for ${slug} is already running (phase: ${existing.currentPhase})`,
    });
    return;
  }

  const spec = specPath(slug);
  if (!fs.existsSync(spec)) {
    res.status(422).json({
      error: `No spec.json found for ${slug}. Complete the interview first.`,
    });
    return;
  }

  let specVersion = "unknown";
  try {
    const raw = JSON.parse(fs.readFileSync(spec, "utf-8")) as {
      spec_version?: string;
    };
    specVersion = raw.spec_version ?? "unknown";
  } catch { /* specVersion stays "unknown" */ }

  const status: BuildStatus = {
    slug,
    specVersion,
    status: "running",
    currentPhase: "plan",
    filesCreated: 0,
    startedAt: new Date().toISOString(),
  };
  builds.set(slug, status);

  console.info(JSON.stringify({ slug, specVersion, event: "build.started" }));

  void runBuild(slug)
    .then(() => {
      const filesCreated = countManifestFiles(slug);
      builds.set(slug, {
        ...status,
        status: "complete",
        currentPhase: "complete",
        filesCreated,
        completedAt: new Date().toISOString(),
      });
      console.info(JSON.stringify({ slug, filesCreated, event: "build.complete" }));
    })
    .catch((err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      builds.set(slug, {
        ...status,
        status: "error",
        errorMessage,
        completedAt: new Date().toISOString(),
      });
      console.error(JSON.stringify({ slug, err: errorMessage, event: "build.error" }));
    });

  res.json(status);
});

// GET /builds/:slug — poll build status
app.get("/builds/:slug", (req: Request, res: Response) => {
  const { slug } = req.params;

  const inMemory = builds.get(slug);
  if (inMemory) {
    res.json(inMemory);
    return;
  }

  const sessionFile = devSessionPath(slug);
  if (!fs.existsSync(sessionFile)) {
    res.status(404).json({ error: `No build found for ${slug}` });
    return;
  }

  try {
    const session = JSON.parse(
      fs.readFileSync(sessionFile, "utf-8")
    ) as DevAgentSession;
    res.json({
      slug,
      specVersion: session.spec_version,
      status: session.current_phase === "complete" ? "complete" : "running",
      currentPhase: session.current_phase,
      filesCreated: countManifestFiles(slug),
      startedAt: session.started_at,
      completedAt:
        session.current_phase === "complete" ? session.updated_at : undefined,
    } satisfies BuildStatus);
  } catch {
    res.status(500).json({ error: "Failed to read build session" });
  }
});

// POST /builds/:slug/continue — manual phase-gate advance (reserved for future UI)
// Currently unused — the auto-approve readline handles gates automatically.
app.post("/builds/:slug/continue", (req: Request, res: Response) => {
  const { slug } = req.params;
  const existing = builds.get(slug);
  if (!existing || existing.status !== "running") {
    res.status(404).json({ error: `No running build for ${slug}` });
    return;
  }
  // Phase gates are already auto-advanced by the readline mock.
  // This endpoint exists for future manual override capability.
  res.json({ ok: true, slug, note: "Phase gates are auto-advanced by the build agent" });
});

// DELETE /builds/:slug — mark build as cancelled
app.delete("/builds/:slug", (req: Request, res: Response) => {
  const { slug } = req.params;
  const existing = builds.get(slug);
  if (existing) {
    builds.set(slug, {
      ...existing,
      status: "error",
      errorMessage: "Cancelled",
      completedAt: new Date().toISOString(),
    });
  }
  res.json({ deleted: true, slug });
});

app.listen(PORT, () => {
  console.info(JSON.stringify({ event: "server_started", service: "coder", port: PORT }));
});
