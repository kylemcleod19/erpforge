/**
 * ERP Forge Dev Agent — Background Job Generator
 *
 * Generates lib/jobs/*.ts for feature_requirements with type: background_job.
 * Also generates lib/jobs/scheduler.ts that registers all jobs on startup.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GeneratorContext, GeneratedFile } from "../../types.js";
import { writePlatformFile } from "../../spec-manager.js";
import { buildSystemPrompt, FLAG_SPEC_ISSUE_TOOL } from "../../prompts/system.js";
import { handleFlaggedIssue } from "../shared/issue-handler.js";
import type * as readline from "readline";

/**
 * Generates background job files for all background_job feature requirements.
 *
 * @param ctx - Generator context
 * @param rl - Readline interface for operator input
 * @returns List of generated files
 */
export async function generateJobs(
  ctx: GeneratorContext,
  rl: readline.Interface
): Promise<GeneratedFile[]> {
  const client = new Anthropic({ apiKey: ctx.apiKey });
  const files: GeneratedFile[] = [];

  const bgJobFeatures = ctx.spec.feature_requirements.filter(
    (f) => f.type === "background_job"
  );

  if (bgJobFeatures.length === 0) return files;

  const jobNames: string[] = [];

  for (const feature of bgJobFeatures) {
    const slug = feature.feature_id.replace(/^feat_/, "").replace(/_/g, "-");
    console.log(`  Generating background job: ${feature.feature_id}...`);

    const prompt = buildJobPrompt(ctx.spec.spec_version, feature.feature_id, feature.name, feature.description, feature.acceptance_criteria);
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

    while (true) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 3072,
        tools: [FLAG_SPEC_ISSUE_TOOL],
        messages,
      });

      if (response.stop_reason === "tool_use") {
        const toolUse = response.content.find((b) => b.type === "tool_use");
        if (toolUse?.type === "tool_use" && toolUse.name === "flag_spec_issue") {
          const input = toolUse.input as { section: string; issue: string; proposed_resolution: string; bump_type: "major" | "minor" | "patch" };
          const amendment = await handleFlaggedIssue(input, rl);
          ctx.pendingAmendments.push(amendment);
          messages.push({ role: "assistant", content: response.content });
          messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: `Resolution: ${amendment.approved_resolution}. Continue.` }] });
          continue;
        }
      }

      const content = response.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("").trim();
      if (content) {
        const relativePath = `src/lib/jobs/${slug}-job.ts`;
        writePlatformFile(ctx.platformDir, relativePath, content);
        files.push({ relativePath, content, specIds: [feature.feature_id], generator: "job-generator" });
        jobNames.push(slug);
      }
      break;
    }
  }

  // Generate scheduler.ts
  if (jobNames.length > 0) {
    const scheduler = buildScheduler(jobNames);
    writePlatformFile(ctx.platformDir, scheduler.relativePath, scheduler.content);
    files.push(scheduler);
  }

  return files;
}

function buildJobPrompt(
  specVersion: string,
  featureId: string,
  name: string,
  description: string,
  acceptanceCriteria: string[]
): string {
  const slug = featureId.replace(/^feat_/, "").replace(/_/g, "-");
  const JobName = slug.split("-").map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join("");

  return `${buildSystemPrompt(specVersion)}

Generate src/lib/jobs/${slug}-job.ts

/**
 * ${name} — Background Job
 * Implements spec section: ${featureId}
 */

FEATURE:
- Name: ${name}
- Description: ${description}
- Acceptance criteria:
${acceptanceCriteria.map((ac) => `  - ${ac}`).join("\n")}

REQUIREMENTS:
1. Export async function run${JobName}(): Promise<void>
2. Export function register${JobName}Job(): cron.ScheduledTask
3. Use node-cron for scheduling
4. Include a running-guard to prevent overlapping executions
5. Log start/complete/error with timestamps
6. Determine an appropriate cron schedule from the acceptance criteria
7. Include WHY comments explaining the business logic`;
}

function buildScheduler(jobNames: string[]): GeneratedFile {
  const imports = jobNames
    .map((slug) => {
      const JobName = slug.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
      return `import { register${JobName}Job } from "./${slug}-job.js";`;
    })
    .join("\n");

  const registrations = jobNames
    .map((slug) => {
      const JobName = slug.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
      return `  const ${slug.replace(/-/g, "")}Task = register${JobName}Job();\n  tasks.push(${slug.replace(/-/g, "")}Task);\n  console.log("  ✓ Registered job: ${slug}");`;
    })
    .join("\n");

  const content = `/**
 * Background Job Scheduler
 * Implements spec section: feature_requirements (background_job types)
 *
 * Registers all background jobs using node-cron.
 * Called once on server startup (e.g., in src/app/layout.tsx or a custom server).
 */

import type { ScheduledTask } from "node-cron";
${imports}

let started = false;
const tasks: ScheduledTask[] = [];

/**
 * Starts all background jobs.
 * Safe to call multiple times — only registers once (idempotent).
 */
export function startScheduler(): void {
  if (started) return;
  started = true;

  console.log("[Scheduler] Starting background jobs...");
${registrations}
  console.log(\`[Scheduler] \${tasks.length} job(s) registered.\`);
}

/**
 * Stops all running background jobs.
 * Call on graceful shutdown.
 */
export function stopScheduler(): void {
  for (const task of tasks) task.stop();
  tasks.length = 0;
  started = false;
  console.log("[Scheduler] All jobs stopped.");
}
`;

  return {
    relativePath: "src/lib/jobs/scheduler.ts",
    content,
    specIds: [],
    generator: "job-generator",
  };
}
