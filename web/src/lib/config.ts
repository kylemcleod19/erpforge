/**
 * Environment variable validation and typed config.
 * Throws at startup if required variables are missing so Railway fails fast
 * rather than silently breaking at runtime.
 */
import path from "path";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue = ""): string {
  return process.env[name] ?? defaultValue;
}

// In production all required vars must be present.
// In development the app starts without them so engineers can iterate quickly.
// During `next build` Next.js sets NEXT_PHASE=phase-production-build and runs
// route modules to collect page data — skip validation then so build containers
// don't need DATABASE_URL present at build time.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
const isProduction = process.env.NODE_ENV === "production" && !isBuildPhase;

// Path to the customers/ directory.
// Must match what interviewer/session.ts computes (path.join(process.cwd(), "customers")).
// - Development (npm run dev from web/): defaults to web/customers/
// - Production (Railway Root Directory = web/): set CUSTOMERS_DIR to the volume mount path
//   e.g. CUSTOMERS_DIR=/app/web/customers if Railway clones to /app and Root Dir = web/
const defaultCustomersDir = path.resolve(process.cwd(), "customers");

export const config = {
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  isProduction,

  databaseUrl: isProduction
    ? requireEnv("DATABASE_URL")
    : optionalEnv("DATABASE_URL"),

  anthropicApiKey: isProduction
    ? requireEnv("ANTHROPIC_API_KEY")
    : optionalEnv("ANTHROPIC_API_KEY"),

  betterAuthSecret: isProduction
    ? requireEnv("BETTER_AUTH_SECRET")
    : optionalEnv("BETTER_AUTH_SECRET", "dev-secret-change-in-production"),

  appUrl: optionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),

  logLevel: optionalEnv("LOG_LEVEL", isProduction ? "info" : "debug"),

  slackWebhookUrl: optionalEnv("SLACK_WEBHOOK_URL"),

  // Set CUSTOMERS_DIR=/app/customers in the Railway environment variable panel.
  customersDir: optionalEnv("CUSTOMERS_DIR", defaultCustomersDir),

  // Internal URLs for the three agent microservices.
  // In Railway: http://<service>.railway.internal:<port>
  // Locally: http://localhost:<port>
  interviewerServiceUrl: optionalEnv("INTERVIEWER_SERVICE_URL", "http://localhost:3001"),
  coderServiceUrl: optionalEnv("CODER_SERVICE_URL", "http://localhost:3002"),
  docsServiceUrl: optionalEnv("DOCS_SERVICE_URL", "http://localhost:3003"),

  // Directory for uploaded files (transcripts, documents). Same volume as customers/.
  uploadsDir: optionalEnv("UPLOADS_DIR", path.resolve(process.cwd(), "uploads")),

  // Max upload size in bytes — default 50 MB
  maxUploadBytes: parseInt(
    optionalEnv("MAX_UPLOAD_BYTES", String(50 * 1024 * 1024)),
    10
  ),
} as const;
