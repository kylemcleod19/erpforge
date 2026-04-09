/**
 * better-auth instance — server-side only.
 *
 * Import this in API routes and Server Components.
 * Never import in Client Components — use auth-client.ts instead.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db/index";
import * as schema from "@/db/schema/index";
import { config } from "./config";

export const auth = betterAuth({
  secret: config.betterAuthSecret,
  baseURL: config.appUrl,
  trustedOrigins: [config.appUrl],

  database: drizzleAdapter(db, { provider: "pg", schema }),

  emailAndPassword: {
    enabled: true,
  },

  plugins: [
    organization(),
    nextCookies(),
  ],

  user: {
    additionalFields: {
      // Platform-level role — separate from the org-level role managed by the organization plugin.
      // Values: "platform_head" | "consultant" | "client_admin" | "client_user"
      role: {
        type: "string" as const,
        required: false,
        defaultValue: "client_user",
        input: true,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
