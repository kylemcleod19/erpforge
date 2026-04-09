/**
 * Next.js Instrumentation Hook
 *
 * Runs once at server startup before any requests are handled.
 * We use it to apply pending database migrations so that:
 *   1. Migrations are always in sync before traffic is served.
 *   2. If migrations fail, the health check at /api/health returns 500
 *      and Railway rolls back the deployment automatically.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run in the Node.js runtime, not in the Edge runtime or during build.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Apply all Drizzle migrations — includes both custom tables (tasks, uploads, etc.)
    // and better-auth tables (user, session, account, organization, etc.) via
    // drizzle/0002_better_auth_tables.sql.
    const { runMigrations } = await import("./db/migrate");
    await runMigrations();
  }
}
