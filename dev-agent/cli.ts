#!/usr/bin/env node
/**
 * ERP Forge Dev Agent CLI
 *
 * Usage:
 *   node dist/dev-agent/cli.js <customer-slug>
 *   ts-node dev-agent/cli.ts <customer-slug>
 *
 * The customer-slug must match a completed interview in customers/<slug>/spec.json
 *
 * Requires:
 *   ANTHROPIC_API_KEY environment variable
 *
 * Output:
 *   customers/<slug>/platform/   — generated Next.js ERP platform
 *   customers/<slug>/dev-session.json — resumable build session
 *   customers/<slug>/build-manifest.json — spec ID → file path mapping
 */

import * as readline from "readline";
import * as path from "path";
import { DevAgent } from "./agent.js";

function main(): void {
  const args = process.argv.slice(2);
  const customerSlug = args[0];

  if (!customerSlug || customerSlug === "--help" || customerSlug === "-h") {
    console.log("ERP Forge Dev Agent");
    console.log("");
    console.log("Usage:");
    console.log("  node dist/dev-agent/cli.js <customer-slug>");
    console.log("");
    console.log("Options:");
    console.log("  --help, -h    Show this help message");
    console.log("");
    console.log("Examples:");
    console.log("  node dist/dev-agent/cli.js acme-precision-parts");
    console.log("  ts-node dev-agent/cli.ts acme-precision");
    console.log("");
    console.log("Prerequisites:");
    console.log("  - Run the interviewer first: npm run interview <customer-slug>");
    console.log("  - Set ANTHROPIC_API_KEY environment variable");
    process.exit(customerSlug ? 0 : 1);
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(customerSlug)) {
    console.error(
      "Error: customer-slug must be lowercase letters, numbers, and hyphens only."
    );
    console.error(`  Got: "${customerSlug}"`);
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set.");
    console.error(
      "  Get your API key at https://console.anthropic.com and set it:"
    );
    console.error("  export ANTHROPIC_API_KEY=sk-ant-...");
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  // Graceful exit on Ctrl+C — session is persisted so build can resume
  rl.on("close", () => {
    console.log(
      "\n\nBuild paused. Run the same command to resume from where you left off."
    );
    process.exit(0);
  });

  process.on("SIGINT", () => {
    rl.close();
  });

  const LINE = "═".repeat(65);
  console.log(`\n${LINE}`);
  console.log(`  ERP FORGE — DEVELOPMENT AGENT`);
  console.log(`  Customer slug: ${customerSlug}`);
  console.log(`  Output: ${path.join(process.cwd(), "customers", customerSlug, "platform")}`);
  console.log(LINE);
  console.log(
    "\nThis agent will read the customer spec and generate a complete ERP platform."
  );
  console.log("You will be shown a build plan and asked to approve it before generation starts.");
  console.log("After each phase, you will be prompted to type 'continue' to proceed.");
  console.log("\nPress Ctrl+C at any time to pause — progress is auto-saved.\n");

  let agent: DevAgent;
  try {
    agent = DevAgent.init(apiKey, rl, customerSlug);
  } catch (err) {
    console.error(`\nError: ${(err as Error).message}`);
    rl.close();
    process.exit(1);
  }

  agent
    .run()
    .then(() => {
      rl.close();
      process.exit(0);
    })
    .catch((err: Error) => {
      console.error("\nDev agent error:", err.message);
      if (process.env.DEBUG) {
        console.error(err.stack);
      }
      rl.close();
      process.exit(1);
    });
}

main();
