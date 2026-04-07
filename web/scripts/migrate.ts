/**
 * Standalone migration CLI — for manual runs and debugging.
 *
 * Usage:  npx tsx scripts/migrate.ts
 *
 * Railway uses the instrumentation hook (src/instrumentation.ts) for
 * automatic migrations at deploy time. This script is for:
 *   - Running migrations locally against a dev database
 *   - Emergency manual migration in production (via Railway shell)
 */
import { runMigrations } from "../src/db/migrate.js";

runMigrations()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
