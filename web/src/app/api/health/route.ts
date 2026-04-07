/**
 * GET /api/health
 *
 * Railway uses this endpoint to determine if a deployment is healthy.
 * Returns HTTP 200 when the service is up and the database is reachable.
 * Returns HTTP 500 when the database is down — Railway will then rollback
 * the deploy or restart the service depending on the failure type.
 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import pkg from "../../../../package.json";

export async function GET(): Promise<NextResponse> {
  const dbStatus = await checkDb();
  const status = dbStatus === "error" ? "degraded" : "ok";
  const httpStatus = dbStatus === "error" ? 500 : 200;

  return NextResponse.json(
    { status, ts: new Date().toISOString(), db: dbStatus, version: pkg.version },
    { status: httpStatus }
  );
}

async function checkDb(): Promise<"ok" | "unconfigured" | "error"> {
  if (!process.env.DATABASE_URL) return "unconfigured";

  try {
    const { db } = await import("@/db/index");
    // Simple liveness check — any error here means the database is unreachable.
    await db.execute(sql`SELECT 1`);
    return "ok";
  } catch {
    return "error";
  }
}
