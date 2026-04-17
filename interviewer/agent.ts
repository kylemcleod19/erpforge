import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import type { InterviewSession } from "./types.js";
import {
  createSession,
  loadSession,
  saveSession,
  ensureCustomerDir,
} from "./session.js";
import { runIntake } from "./phases/intake.js";
import { routeModules } from "./phases/router.js";
import { runAllModules } from "./phases/module-runner.js";
import { runGapAnalysis } from "./phases/researcher.js";
import { runHumanReview } from "./phases/reviewer.js";
import { compileSpec } from "./phases/compiler.js";

export class InterviewAgent {
  private client: Anthropic;
  private rl: readline.Interface;
  private session: InterviewSession;

  constructor(
    apiKey: string,
    rl: readline.Interface,
    session: InterviewSession
  ) {
    this.client = new Anthropic({ apiKey });
    this.rl = rl;
    this.session = session;
  }

  /**
   * Creates or resumes a session for the given customer slug.
   */
  static init(
    apiKey: string,
    rl: readline.Interface,
    customerSlug: string
  ): InterviewAgent {
    ensureCustomerDir(customerSlug);
    const existing = loadSession(customerSlug);

    if (existing) {
      console.log(
        `\nResuming interview for ${existing.intake?.company_name ?? customerSlug} (phase: ${existing.current_phase})\n`
      );
      return new InterviewAgent(apiKey, rl, existing);
    }

    const session = createSession(customerSlug);
    saveSession(session);
    return new InterviewAgent(apiKey, rl, session);
  }

  async run(): Promise<void> {
    let session = this.session;

    // Resume from current phase
    switch (session.current_phase) {
      case "intake":
        session = await runIntake(session, this.client, this.makeMessageHandler());
        // Fall through to routing
      // eslint-disable-next-line no-fallthrough
      case "routing":
        this.print(
          "One moment — determining follow-up topics."
        );
        session = await routeModules(session, this.client);
        // Fall through to modules
      // eslint-disable-next-line no-fallthrough
      case "modules":
        session = await runAllModules(
          session,
          this.client,
          this.makeMessageHandler(),
          (msg) => this.printStatus(msg)
        );
        // Fall through to gap analysis
      // eslint-disable-next-line no-fallthrough
      case "gap_analysis":
        session = await runGapAnalysis(
          session,
          this.client,
          this.makeMessageHandler()
        );
        // Fall through to review
      // eslint-disable-next-line no-fallthrough
      case "review":
        this.print(
          `Interview complete. The spec will be compiled after internal review.`
        );
        console.log("\n[Switching to operator review mode...]\n");
        session = await runHumanReview(session, this.rl);
        // Fall through to compilation
      // eslint-disable-next-line no-fallthrough
      case "compilation":
        session = await compileSpec(session, this.client);
        // Fall through to complete
      // eslint-disable-next-line no-fallthrough
      case "complete":
        this.printCompletion(session);
        break;
    }

    this.session = session;
  }

  private makeMessageHandler(): (
    role: "assistant" | "user",
    content: string
  ) => Promise<string> {
    return async (role, content) => {
      if (role === "assistant") {
        this.print(content);
        return this.promptUser();
      }
      // If called with "user" role (shouldn't normally happen), just return empty
      return "";
    };
  }

  private print(message: string): void {
    console.log(`\nInterviewer: ${message}\n`);
  }

  private printStatus(message: string): void {
    console.log(`\n[${message}]\n`);
  }

  private async promptUser(): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question("> ", (answer) => {
        resolve(answer);
      });
    });
  }

  private printCompletion(session: InterviewSession): void {
    console.log("\n" + "═".repeat(60));
    console.log("  ✓ SPEC COMPLETE");
    console.log("═".repeat(60));
    if (session.spec_path) {
      console.log(`  Spec saved to: ${session.spec_path}`);
    }
    console.log(
      `  Modules completed: ${session.completed_modules.join(", ")}`
    );
    console.log(`  Review flags: ${session.review_flags.length}`);
    console.log("═".repeat(60) + "\n");
  }
}
