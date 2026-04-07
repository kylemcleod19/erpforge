/**
 * ERP Forge Dev Agent — Spec Issue Handler
 *
 * Shared utility for handling flag_spec_issue tool calls during generation.
 * Prompts the operator for a resolution and builds a SpecAmendment.
 */

import * as readline from "readline";
import type { SpecAmendment } from "../../types.js";

/**
 * Handles a flag_spec_issue tool call from a generation prompt.
 * Displays the issue to the operator, prompts for a resolution,
 * and returns a SpecAmendment to apply to the spec.
 *
 * @param input - The flag_spec_issue tool input from Claude
 * @param rl - Readline interface for operator input
 * @returns The resolved SpecAmendment
 */
export async function handleFlaggedIssue(
  input: {
    section: string;
    issue: string;
    proposed_resolution: string;
    bump_type: "major" | "minor" | "patch";
  },
  rl: readline.Interface
): Promise<SpecAmendment> {
  console.log("\n" + "─".repeat(60));
  console.log("  ⚠  SPEC ISSUE FLAGGED BY GENERATOR");
  console.log("─".repeat(60));
  console.log(`  Section:  ${input.section}`);
  console.log(`  Issue:    ${input.issue}`);
  console.log(`  Proposed: ${input.proposed_resolution}`);
  console.log(`  Bump:     ${input.bump_type}`);
  console.log("─".repeat(60));
  console.log(`  Press ENTER to accept the proposed resolution,`);
  console.log(`  or type your own resolution:\n`);

  const operatorInput = await prompt(rl, "> ");
  const approvedResolution =
    operatorInput.trim() || input.proposed_resolution;

  let operatorNote: string | undefined;
  if (operatorInput.trim()) {
    operatorNote = `Operator provided custom resolution: ${operatorInput.trim()}`;
  }

  console.log(`\n  ✓ Resolution accepted: ${approvedResolution}\n`);

  return {
    flagged_at: new Date().toISOString(),
    section: input.section,
    issue: input.issue,
    proposed_resolution: input.proposed_resolution,
    approved_resolution: approvedResolution,
    bump_type: input.bump_type,
    operator_note: operatorNote,
  };
}

/**
 * Prompts the operator for a yes/no confirmation.
 *
 * @param rl - Readline interface
 * @param question - Question to display
 * @returns true if operator typed y/yes, false otherwise
 */
export async function confirmPrompt(
  rl: readline.Interface,
  question: string
): Promise<boolean> {
  const answer = await prompt(rl, `${question} [y/N] `);
  return /^y(es)?$/i.test(answer.trim());
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}
