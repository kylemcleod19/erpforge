/**
 * Server-side session helpers.
 *
 * Use these in Server Components and API route handlers.
 * Never call auth.api.getSession directly — always use these helpers.
 */
import { headers } from "next/headers";
import { auth } from "./auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

/**
 * Returns the session if the user has the given platform role.
 * Throws if not authenticated or the role doesn't match.
 */
export async function requireRole(role: string) {
  const session = await requireSession();
  const user = session.user as typeof session.user & { role?: string };
  if (user.role !== role) {
    throw new Error("Forbidden");
  }
  return session;
}

/**
 * Returns the session if the user has one of the given platform roles.
 */
export async function requireAnyRole(...roles: string[]) {
  const session = await requireSession();
  const user = session.user as typeof session.user & { role?: string };
  if (!roles.includes(user.role ?? "")) {
    throw new Error("Forbidden");
  }
  return session;
}
