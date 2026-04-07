/**
 * ERP Forge Dev Agent — Main Orchestrator
 *
 * Reads a completed customer spec.json and generates a full Next.js 15
 * App Router ERP platform in customers/<slug>/platform/.
 *
 * Build order: Scaffold → Database → API → Frontend → Integrations → AI → Docs
 * Each phase gates on operator "continue" before proceeding.
 */

import * as readline from "readline";
import type {
  ErpSpec,
  GeneratorContext,
  DevAgentSession,
  BuildPlan,
} from "./types.js";
import {
  loadSpec,
  ensurePlatformDir,
  devSessionPath,
  specPath,
  applyAmendments,
} from "./spec-manager.js";
import {
  createManifest,
  loadManifest,
  saveManifest,
} from "./build-manifest.js";
import { generateBuildPlan, printBuildPlan } from "./plan-generator.js";
import { runScaffoldPhase } from "./phases/scaffold.js";
import { runDatabasePhase } from "./phases/database.js";
import { runApiPhase } from "./phases/api.js";
import { runFrontendPhase } from "./phases/frontend.js";
import { runIntegrationsPhase } from "./phases/integrations.js";
import { runAiTouchpointsPhase } from "./phases/ai-touchpoints.js";
import { runDocsPhase as runDocsPhaseFn } from "./phases/docs.js";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

export class DevAgent {
  private readonly rl: readline.Interface;
  private session: DevAgentSession;
  private ctx: GeneratorContext;

  constructor(
    rl: readline.Interface,
    session: DevAgentSession,
    spec: ErpSpec,
    apiKey: string
  ) {
    this.rl = rl;
    this.session = session;
    this.ctx = {
      spec,
      customerSlug: session.customer_slug,
      platformDir: session.platform_dir,
      apiKey,
      pendingAmendments: [],
    };
  }

  /**
   * Creates or resumes a dev agent session for a customer.
   *
   * @param apiKey - Anthropic API key
   * @param rl - Readline interface
   * @param customerSlug - Customer identifier
   * @returns Initialized DevAgent
   */
  static init(
    apiKey: string,
    rl: readline.Interface,
    customerSlug: string
  ): DevAgent {
    const spec = loadSpec(customerSlug);
    const platformDir = ensurePlatformDir(customerSlug);

    // Resume existing session if present
    const sessionFile = devSessionPath(customerSlug);
    if (fs.existsSync(sessionFile)) {
      const existing = JSON.parse(
        fs.readFileSync(sessionFile, "utf-8")
      ) as DevAgentSession;
      console.log(
        `\nResuming dev agent for ${spec.business_profile.company_name} (phase: ${existing.current_phase})\n`
      );
      return new DevAgent(rl, existing, spec, apiKey);
    }

    const now = new Date().toISOString();
    const session: DevAgentSession = {
      session_id: uuidv4(),
      customer_slug: customerSlug,
      started_at: now,
      updated_at: now,
      current_phase: "plan",
      spec_version: spec.spec_version,
      spec_path: specPath(customerSlug),
      platform_dir: platformDir,
      build_plan: null,
      applied_amendments: [],
      phase_gates: {},
    };

    return new DevAgent(rl, session, spec, apiKey);
  }

  /**
   * Runs the dev agent through all phases with operator approval gates.
   */
  async run(): Promise<void> {
    const session = this.session;

    switch (session.current_phase) {
      case "plan":
        await this.runPlanPhase();
        // fall through
      // eslint-disable-next-line no-fallthrough
      case "scaffold":
        await this.runPhase("scaffold", (ctx, manifest, rl) =>
          runScaffoldPhase(ctx, manifest, rl)
        );
        // fall through
      // eslint-disable-next-line no-fallthrough
      case "database":
        await this.runPhase("database", (ctx, manifest, rl) =>
          runDatabasePhase(ctx, manifest, rl)
        );
        // fall through
      // eslint-disable-next-line no-fallthrough
      case "api":
        await this.runPhase("api", (ctx, manifest, rl) =>
          runApiPhase(ctx, manifest, rl)
        );
        // fall through
      // eslint-disable-next-line no-fallthrough
      case "frontend":
        await this.runPhase("frontend", (ctx, manifest, rl) =>
          runFrontendPhase(ctx, manifest, rl)
        );
        // fall through
      // eslint-disable-next-line no-fallthrough
      case "integrations":
        await this.runPhase("integrations", (ctx, manifest, rl) =>
          runIntegrationsPhase(ctx, manifest, rl)
        );
        // fall through
      // eslint-disable-next-line no-fallthrough
      case "ai_touchpoints":
        await this.runPhase("ai_touchpoints", (ctx, manifest, rl) =>
          runAiTouchpointsPhase(ctx, manifest, rl)
        );
        // fall through
      // eslint-disable-next-line no-fallthrough
      case "docs":
        await this.runDocsPhase();
        // fall through
      // eslint-disable-next-line no-fallthrough
      case "complete":
        break;
    }
  }

  // ─── Phase Runners ──────────────────────────────────────────────────────────

  private async runPlanPhase(): Promise<void> {
    const plan = generateBuildPlan(this.ctx.spec, this.ctx.customerSlug);
    printBuildPlan(plan);

    // Resolve operator-decision flags before proceeding
    const blockers = plan.pre_build_flags.filter(
      (f) => f.requires_operator_decision
    );

    if (blockers.length > 0) {
      console.log(
        `  ${blockers.length} pre-build flag(s) require your input above.\n`
      );
      console.log(`  Type 'accept' to accept all proposed defaults,`);
      console.log(`  or type a flag number (e.g. '1') to set a custom resolution:\n`);

      for (const flag of blockers) {
        const answer = await this.prompt(
          `  Flag [${flag.number}] — accept default? (y) or enter custom resolution: `
        );
        flag.operator_resolution =
          answer.trim() === "" || answer.trim().toLowerCase() === "y"
            ? flag.proposed_default
            : answer.trim();
      }

      // Apply automatic defaults for non-decision flags
      for (const flag of plan.pre_build_flags.filter((f) => !f.requires_operator_decision)) {
        flag.operator_resolution = flag.proposed_default;
      }

      console.log("\n  Pre-build flags resolved. Review and type 'continue' to start:\n");
      await this.waitForContinue("plan");
    } else {
      console.log(
        "  No blocking pre-build flags. Type 'continue' to start generation:\n"
      );
      await this.waitForContinue("plan");
    }

    plan.approved = true;
    plan.approved_at = new Date().toISOString();
    this.session.build_plan = plan;
    this.session.current_phase = "scaffold";
    this.saveSession();
  }

  private async runPhase(
    phaseName: DevAgentSession["current_phase"],
    runner: (
      ctx: GeneratorContext,
      manifest: import("./types.js").BuildManifest,
      rl: readline.Interface
    ) => Promise<import("./types.js").PhaseGateResult>
  ): Promise<void> {
    if (this.session.current_phase !== phaseName) return;

    // Load or create manifest
    const manifest =
      loadManifest(this.ctx.customerSlug) ??
      createManifest(this.ctx.customerSlug, this.ctx.spec.spec_version);

    const result = await runner(this.ctx, manifest, this.rl);

    // Apply any pending amendments
    if (this.ctx.pendingAmendments.length > 0) {
      this.ctx.spec = applyAmendments(
        this.ctx.customerSlug,
        this.ctx.spec,
        this.ctx.pendingAmendments
      );
      this.session.applied_amendments.push(...this.ctx.pendingAmendments);
      this.ctx.pendingAmendments = [];
    }

    this.session.phase_gates[phaseName] = result;

    // Advance to next phase
    const phaseOrder: DevAgentSession["current_phase"][] = [
      "plan", "scaffold", "database", "api", "frontend",
      "integrations", "ai_touchpoints", "docs", "complete",
    ];
    const idx = phaseOrder.indexOf(phaseName);
    this.session.current_phase = phaseOrder[idx + 1] ?? "complete";
    this.saveSession();

    if (this.session.current_phase !== "complete") {
      await this.waitForContinue(phaseName);
    }
  }

  private async runDocsPhase(): Promise<void> {
    if (this.session.current_phase !== "docs") return;

    const manifest =
      loadManifest(this.ctx.customerSlug) ??
      createManifest(this.ctx.customerSlug, this.ctx.spec.spec_version);

    const totalAmendments = this.session.applied_amendments.length;
    const result = await runDocsPhaseFn(
      this.ctx,
      manifest,
      totalAmendments,
      this.rl
    );

    this.session.phase_gates["docs"] = result;
    this.session.current_phase = "complete";
    this.saveSession();
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async waitForContinue(afterPhase: string): Promise<void> {
    let input = "";
    while (input.trim().toLowerCase() !== "continue") {
      input = await this.prompt(
        `\n  [Phase ${afterPhase} complete] Type 'continue' to proceed: `
      );
    }
  }

  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => this.rl.question(question, resolve));
  }

  private saveSession(): void {
    this.session.updated_at = new Date().toISOString();
    const p = devSessionPath(this.ctx.customerSlug);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(this.session, null, 2));
  }
}
