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
    // 1. Apply Drizzle migrations (custom tables: tasks, uploads, etc.)
    const { runMigrations } = await import("./db/migrate");
    await runMigrations();

    // 2. Apply better-auth migrations (user, session, account, organization, etc.)
    //    better-auth manages its own tables separately from Drizzle.
    const { auth } = await import("./lib/auth");
    // getMigrations is not re-exported from better-auth/db index — import directly
    const { getMigrations } = await import("better-auth/db/migration");
    const { runMigrations: runAuthMigrations } = await getMigrations(auth.options);
    await runAuthMigrations();
  }
}
