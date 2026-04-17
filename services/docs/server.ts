/**
 * ERP Forge — Docs Microservice
 *
 * Standalone Express server for on-demand documentation generation.
 * Reads a completed spec.json and (optionally) a build manifest to produce
 * HANDOFF.md and CUSTOMER_SUMMARY.md, callable independently of the full build.
 *
 * API:
 *   POST   /docs                        — trigger generation (async)
 *   GET    /docs/:slug                  — job status + artifact list
 *   GET    /docs/:slug/spec-summary     — return CUSTOMER_SUMMARY.md
 *   GET    /docs/:slug/openapi          — return openapi.json (if generated)
 *   GET    /health                      — liveness check
 */

import express, { type Request, type Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { generateDocs } from "../../dev-agent/generators/docs/docs-generator";
import {
  loadSpec,
  platformDir as getPlatformDir,
  buildManifestPath,
} from "../../dev-agent/spec-manager";
import { createManifest, loadManifest } from "../../dev-agent/build-manifest";
import type { GeneratorContext } from "../../dev-agent/types";

const PORT = parseInt(process.env.PORT ?? "3003", 10);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const CUSTOMERS_DIR =
  process.env.CUSTOMERS_DIR ?? path.join(process.cwd(), "customers");

// ─── Types ────────────────────────────────────────────────────────────────────

type DocJobStatus = "running" | "complete" | "error";

interface DocJob {
  slug: string;
  status: DocJobStatus;
  artifacts: string[];
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

const jobs = new Map<string, DocJob>();

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "docs", ts: new Date().toISOString() });
});

// POST /docs — trigger doc generation for a slug
app.post("/docs", (req: Request, res: Response) => {
  const { slug } = req.body as { slug?: string };
  if (!slug || typeof slug !== "string") {
    res.status(400).json({ error: "slug is required" });
    return;
  }

  const existing = jobs.get(slug);
  if (existing && existing.status === "running") {
    res.status(409).json({ error: `Docs generation for ${slug} is already running` });
    return;
  }

  let spec;
  try {
    spec = loadSpec(slug);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : String(err) });
    return;
  }

  const platformDir = getPlatformDir(slug);
  const job: DocJob = {
    slug,
    status: "running",
    artifacts: [],
    startedAt: new Date().toISOString(),
  };
  jobs.set(slug, job);

  // Load existing manifest or create a minimal one for the docs generator
  const manifest =
    loadManifest(slug) ?? createManifest(slug, spec.spec_version);

  const ctx: GeneratorContext = {
    spec,
    customerSlug: slug,
    platformDir,
    apiKey: ANTHROPIC_API_KEY,
    pendingAmendments: [],
  };

  void (async () => {
    try {
      const files = await generateDocs(ctx, manifest, 0);
      const artifacts = files.map((f) => f.relativePath);
      jobs.set(slug, {
        ...job,
        status: "complete",
        artifacts,
        completedAt: new Date().toISOString(),
      });
      console.info(JSON.stringify({ slug, artifacts, event: "docs.complete" }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      jobs.set(slug, {
        ...job,
        status: "error",
        errorMessage,
        completedAt: new Date().toISOString(),
      });
      console.error(JSON.stringify({ slug, err: errorMessage, event: "docs.error" }));
    }
  })();

  res.json({ jobId: slug, status: "running" });
});

// GET /docs/:slug — job status
app.get("/docs/:slug", (req: Request, res: Response) => {
  const { slug } = req.params;
  const job = jobs.get(slug);
  if (!job) {
    res.status(404).json({ error: `No docs job found for ${slug}` });
    return;
  }
  res.json(job);
});

// GET /docs/:slug/spec-summary — CUSTOMER_SUMMARY.md
app.get("/docs/:slug/spec-summary", (req: Request, res: Response) => {
  const { slug } = req.params;
  const summaryPath = path.join(
    CUSTOMERS_DIR,
    slug,
    "platform",
    "docs",
    "CUSTOMER_SUMMARY.md"
  );
  if (!fs.existsSync(summaryPath)) {
    res.status(404).json({
      error: "Spec summary not yet generated. POST to /docs first.",
    });
    return;
  }
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.send(fs.readFileSync(summaryPath, "utf-8"));
});

// GET /docs/:slug/openapi — openapi.json
app.get("/docs/:slug/openapi", (req: Request, res: Response) => {
  const { slug } = req.params;
  const openApiPath = path.join(
    CUSTOMERS_DIR,
    slug,
    "platform",
    "docs",
    "openapi.json"
  );
  if (!fs.existsSync(openApiPath)) {
    res.status(404).json({ error: "OpenAPI spec not yet generated." });
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.send(fs.readFileSync(openApiPath, "utf-8"));
});

app.listen(PORT, () => {
  console.info(JSON.stringify({ event: "server_started", service: "docs", port: PORT }));
});
