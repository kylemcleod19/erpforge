/**
 * API response helpers.
 * All routes return a consistent envelope:
 *   Success: { ok: true,  data: T }
 *   Error:   { ok: false, error: { message: string, code?: string } }
 */
import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function created<T>(data: T): NextResponse {
  return ok(data, 201);
}

export function apiError(
  message: string,
  status = 400,
  code?: string
): NextResponse {
  return NextResponse.json(
    { ok: false, error: { message, ...(code && { code }) } },
    { status }
  );
}

export function notFound(resource = "Resource"): NextResponse {
  return apiError(`${resource} not found`, 404, "NOT_FOUND");
}

export function serverError(message = "Internal server error"): NextResponse {
  return apiError(message, 500, "INTERNAL_ERROR");
}
