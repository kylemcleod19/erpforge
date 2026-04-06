#!/usr/bin/env node
/**
 * ERP Forge Interviewer CLI
 *
 * Usage:
 *   node dist/interviewer/cli.js <customer-slug>
 *   ts-node interviewer/cli.ts <customer-slug>
 *
 * The customer-slug is a short identifier for the customer, e.g. "acme-precision"
 * Session data is stored in customers/<slug>/session.json
 * Output spec is written to customers/<slug>/spec.json
 *
 * Requires environment variable: ANTHROPIC_API_KEY
 */

import * as readline from "readline";
import { InterviewAgent } from "./agent.js";

function main(): void {
  const args = process.argv.slice(2);
  const customerSlug = args[0];

  if (!customerSlug) {
    console.error("Usage: node cli.js <customer-slug>");
    console.error("Example: node cli.js acme-precision-parts");
    process.exit(1);
  }

  // Validate slug
  if (!/^[a-z0-9-]+$/.test(customerSlug)) {
    console.error(
      "customer-slug must be lowercase letters, numbers, and hyphens only."
    );
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set.");
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  // Graceful exit on Ctrl+C
  rl.on("close", () => {
    console.log("\n\nInterview paused. Run the same command to resume.");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    rl.close();
  });

  console.log("\n" + "═".repeat(60));
  console.log("  ERP FORGE — CUSTOMER INTERVIEW");
  console.log(`  Customer slug: ${customerSlug}`);
  console.log("═".repeat(60));
  console.log("\nType your responses at the > prompt.");
  console.log("Press Ctrl+C at any time to pause — progress is auto-saved.\n");

  const agent = InterviewAgent.init(apiKey, rl, customerSlug);

  agent
    .run()
    .then(() => {
      rl.close();
      process.exit(0);
    })
    .catch((err: Error) => {
      console.error("\nError:", err.message);
      rl.close();
      process.exit(1);
    });
}

main();
