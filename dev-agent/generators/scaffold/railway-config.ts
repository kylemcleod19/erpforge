/**
 * ERP Forge Dev Agent — Railway Config Generator
 *
 * Generates railway.toml and .env.example for Railway deployment.
 * Rule-based — no AI calls.
 */

import type { GeneratorContext, GeneratedFile } from "../../types.js";
import { writePlatformFile } from "../../spec-manager.js";

/**
 * Generates railway.toml and .env.example files.
 *
 * @param ctx - Generator context with spec and platform directory
 * @returns List of generated files
 */
export function generateRailwayConfig(ctx: GeneratorContext): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  const railway = buildRailwayToml();
  writePlatformFile(ctx.platformDir, "railway.toml", railway.content);
  files.push(railway);

  const envExample = buildEnvExample(ctx);
  writePlatformFile(ctx.platformDir, ".env.example", envExample.content);
  files.push(envExample);

  return files;
}

function buildRailwayToml(): GeneratedFile {
  const content = `[build]
  builder = "nixpacks"

[deploy]
  # Runs migrations then starts the Next.js server.
  # DATABASE_URL is automatically injected by the Railway Postgres plugin.
  startCommand = "npx tsx scripts/migrate.ts && node .next/standalone/server.js"
  healthcheckPath = "/api/health"
  healthcheckTimeout = 300
  restartPolicyType = "on_failure"
  restartPolicyMaxRetries = 3
`;
  return {
    relativePath: "railway.toml",
    content,
    specIds: ["development_standards"],
    generator: "railway-config",
  };
}

function buildEnvExample(ctx: GeneratorContext): GeneratedFile {
  const spec = ctx.spec;
  const lines: string[] = [
    "# ─── Database ──────────────────────────────────────────────────────",
    "# Automatically provided by Railway Postgres plugin",
    "DATABASE_URL=postgresql://user:password@host:5432/dbname",
    "",
    "# ─── Auth ──────────────────────────────────────────────────────────",
    "# Generate with: openssl rand -base64 32",
    "AUTH_SECRET=",
    "# Public URL of this deployment (used for OAuth callbacks)",
    "NEXT_PUBLIC_APP_URL=https://your-app.railway.app",
    "",
    "# ─── AI ─────────────────────────────────────────────────────────────",
  ];

  if (spec.ai_touchpoints.length > 0) {
    lines.push("# Get your key at https://console.anthropic.com");
    lines.push("ANTHROPIC_API_KEY=");
  } else {
    lines.push("# ANTHROPIC_API_KEY= (no AI touchpoints defined in spec)");
  }

  if (spec.integration_points.length > 0) {
    lines.push("");
    lines.push("# ─── Integrations ──────────────────────────────────────────────────");
    for (const int of spec.integration_points) {
      lines.push(`# ${int.name}`);
      const authConfig = int.auth_config ?? {};
      for (const [key] of Object.entries(authConfig)) {
        const envKey = `${int.integration_id.toUpperCase().replace("INT_", "")}_${key.toUpperCase()}`;
        lines.push(`${envKey}=`);
      }
      if (int.auth_method === "oauth2") {
        const slug = int.integration_id.replace("int_", "").toUpperCase();
        lines.push(`${slug}_CLIENT_ID=`);
        lines.push(`${slug}_CLIENT_SECRET=`);
      }
      if (int.auth_method === "webhook_secret" || int.endpoints.some((e) => e.direction === "inbound")) {
        const slug = int.integration_id.replace("int_", "").toUpperCase();
        lines.push(`${slug}_WEBHOOK_SECRET=`);
      }
      lines.push("");
    }
  }

  lines.push("# ─── Optional ──────────────────────────────────────────────────────");
  lines.push("# NODE_ENV=production (set automatically by Railway)");
  lines.push("# PORT=3000 (set automatically by Railway)");

  return {
    relativePath: ".env.example",
    content: lines.join("\n") + "\n",
    specIds: [
      "development_standards",
      ...spec.integration_points.map((i) => i.integration_id),
    ],
    generator: "railway-config",
  };
}
