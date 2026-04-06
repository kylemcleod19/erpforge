import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import type { InterviewSession } from "./types.js";

const CUSTOMERS_DIR = path.join(process.cwd(), "customers");

export function sessionPath(customerSlug: string): string {
  return path.join(CUSTOMERS_DIR, customerSlug, "session.json");
}

export function specOutputPath(customerSlug: string): string {
  return path.join(CUSTOMERS_DIR, customerSlug, "spec.json");
}

export function artifactsDir(customerSlug: string): string {
  return path.join(CUSTOMERS_DIR, customerSlug, "artifacts");
}

export function createSession(customerSlug: string): InterviewSession {
  const now = new Date().toISOString();
  return {
    session_id: uuidv4(),
    customer_slug: customerSlug,
    started_at: now,
    updated_at: now,
    current_phase: "intake",
    current_module: null,
    intake: null,
    selected_modules: [],
    completed_modules: [],
    module_responses: {},
    research_cache: {},
    gap_analysis: null,
    review_flags: [],
    operator_notes: [],
    messages: [],
    artifacts: [],
    spec_path: null,
  };
}

export function loadSession(customerSlug: string): InterviewSession | null {
  const p = sessionPath(customerSlug);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw) as InterviewSession;
}

export function saveSession(session: InterviewSession): void {
  session.updated_at = new Date().toISOString();
  const dir = path.join(CUSTOMERS_DIR, session.customer_slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(artifactsDir(session.customer_slug), { recursive: true });
  fs.writeFileSync(sessionPath(session.customer_slug), JSON.stringify(session, null, 2));
}

export function ensureCustomerDir(customerSlug: string): void {
  const dir = path.join(CUSTOMERS_DIR, customerSlug);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(artifactsDir(customerSlug), { recursive: true });
}
