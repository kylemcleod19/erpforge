import * as readline from "readline";
import type { InterviewSession, ReviewFlag, OperatorNote } from "../types.js";
import { saveSession } from "../session.js";

/**
 * Phase 5: Human Review Interface.
 * Separate operator session (not shown to the customer).
 * Presents all review flags and collects operator notes.
 */
export async function runHumanReview(
  session: InterviewSession,
  rl: readline.Interface
): Promise<InterviewSession> {
  const flags = session.review_flags;

  console.log("\n" + "═".repeat(60));
  console.log("  ERP FORGE — OPERATOR REVIEW");
  console.log("  Customer: " + session.intake!.company_name);
  console.log("═".repeat(60));
  console.log();

  if (flags.length === 0) {
    console.log("✓ No review flags raised. The interview looks clean.\n");
  } else {
    console.log(`${flags.length} flag(s) require your review:\n`);

    for (let i = 0; i < flags.length; i++) {
      const flag = flags[i];
      const severityIcon =
        flag.severity === "blocker"
          ? "🔴"
          : flag.severity === "warning"
          ? "🟡"
          : "ℹ️";

      console.log(`${severityIcon}  Flag ${i + 1}/${flags.length}`);
      console.log(`   Module:    ${flag.source_module}`);
      console.log(`   Message:   ${flag.message}`);
      console.log(`   Suggested: ${flag.suggested_action}`);
      console.log();
      console.log(
        '   Commands: [a]pprove  [n]ote <text>  [q]uestion <text>  [s]kip'
      );

      let resolved = false;
      while (!resolved) {
        const input = await prompt(rl, "   > ");
        const trimmed = input.trim();

        if (trimmed === "a" || trimmed === "approve") {
          flags[i].operator_disposition = "approved";
          console.log("   ✓ Approved.\n");
          resolved = true;
        } else if (trimmed.startsWith("n ") || trimmed.startsWith("note ")) {
          const note = trimmed.replace(/^(n|note)\s+/, "");
          flags[i].operator_disposition = "noted";
          flags[i].operator_note = note;
          addOperatorNote(session, note);
          console.log("   ✓ Note saved.\n");
          resolved = true;
        } else if (
          trimmed.startsWith("q ") ||
          trimmed.startsWith("question ")
        ) {
          const followUp = trimmed.replace(/^(q|question)\s+/, "");
          flags[i].operator_disposition = "noted";
          addOperatorNote(session, flag.message, followUp);
          console.log("   ✓ Follow-up question saved.\n");
          resolved = true;
        } else if (trimmed === "s" || trimmed === "skip") {
          flags[i].operator_disposition = "skipped";
          console.log("   ✓ Skipped.\n");
          resolved = true;
        } else {
          console.log(
            '   Unknown command. Use: a, n <text>, q <text>, or s'
          );
        }
      }
    }
  }

  // Optional free-form notes
  console.log("Any additional notes before we compile the spec?");
  console.log('(Type a note and press Enter, or press Enter to skip)');
  const additionalNote = await prompt(rl, "> ");
  if (additionalNote.trim()) {
    addOperatorNote(session, additionalNote.trim());
  }

  session.current_phase = "compilation";
  saveSession(session);

  console.log("\n✓ Review complete. Compiling spec...\n");
  return session;
}

function addOperatorNote(
  session: InterviewSession,
  note: string,
  followUpQuestion?: string
): void {
  const entry: OperatorNote = {
    added_at: new Date().toISOString(),
    note,
  };
  if (followUpQuestion) entry.follow_up_question = followUpQuestion;
  session.operator_notes.push(entry);
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}
