/**
 * Browser-side auth client — use only in Client Components ("use client").
 *
 * Never import this in Server Components or API routes — use lib/session.ts there.
 */
import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [organizationClient()],
});

export type { Session } from "./auth";
