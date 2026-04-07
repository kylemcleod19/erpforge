/**
 * Programmatic migration runner.
 * Called at startup via src/instrumentation.ts so migrations are always
 * applied before the first request is handled.
 *
 * Uses drizzle-orm's built-in migrator which reads the SQL files in
 * web/drizzle/ and applies any that haven't been recorded in the
 * __drizzle_migrations table yet. Safe to call on every boot.
 */
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "path";
import { childLogger } from "../lib/logger";

const log = childLogger("migrate");

export async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    log.warn("DATABASE_URL not set — skipping migrations");
    return;
  }

  // Migration files live at web/drizzle/ (one level up from web/src/).
  // In the Next.js standalone build the CWD is the standalone output
  // directory, so we resolve relative to this file's location.
  const migrationsFolder = path.resolve(
    // import.meta is not available in all Next.js module contexts;
    // use __dirname polyfill via process.cwd() fallback.
    process.cwd(),
    "drizzle"
  );

  log.info({ migrationsFolder }, "Running database migrations");

  try {
    const { db } = await import("./index.js");
    await migrate(db, { migrationsFolder });
    log.info("Migrations complete");
  } catch (err) {
    log.error({ err }, "Migration failed");
    throw err;
  }
}
