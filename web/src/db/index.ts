/**
 * Drizzle Database Singleton
 *
 * Lazy-initialized: the connection is created on first use, not at module
 * import time. This allows Next.js to import route modules during `next build`
 * without a DATABASE_URL present in the build environment.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  _erpforgePgClient?: ReturnType<typeof postgres>;
};

let _db: DrizzleDB | null = null;

function getDb(): DrizzleDB {
  if (_db) return _db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
        "Add it to .env.local for local development, or configure the Railway Postgres plugin."
    );
  }

  const pgClient =
    globalForDb._erpforgePgClient ??
    postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb._erpforgePgClient = pgClient;
  }

  _db = drizzle(pgClient, { schema });
  return _db;
}

// Proxy so callers use `db.select(...)` as normal — connection is only
// established on first property access (i.e. first actual query).
export const db = new Proxy({} as DrizzleDB, {
  get(_, prop: string | symbol) {
    return (getDb() as any)[prop];
  },
});
export type DB = typeof db;

// Re-export schema for convenience in routes and services.
export * from "./schema/index";
