/**
 * ERP Forge Dev Agent — better-auth Generator
 *
 * Generates lib/auth/index.ts (better-auth instance) and lib/auth/roles.ts
 * from the spec's development_standards.roles[].
 * Rule-based — no AI calls.
 */

import type { GeneratorContext, GeneratedFile } from "../../types.js";
import { writePlatformFile } from "../../spec-manager.js";

/**
 * Generates better-auth configuration files.
 *
 * @param ctx - Generator context
 * @returns List of generated files
 */
export function generateBetterAuth(ctx: GeneratorContext): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  const authIndex = buildAuthIndex(ctx);
  writePlatformFile(ctx.platformDir, authIndex.relativePath, authIndex.content);
  files.push(authIndex);

  const authRoles = buildAuthRoles(ctx);
  writePlatformFile(ctx.platformDir, authRoles.relativePath, authRoles.content);
  files.push(authRoles);

  const authClient = buildAuthClient(ctx);
  writePlatformFile(ctx.platformDir, authClient.relativePath, authClient.content);
  files.push(authClient);

  const authRoute = buildAuthRoute();
  writePlatformFile(ctx.platformDir, authRoute.relativePath, authRoute.content);
  files.push(authRoute);

  return files;
}

function buildAuthIndex(ctx: GeneratorContext): GeneratedFile {
  const roles = ctx.spec.development_standards.roles;
  const roleIds = roles.map((r) => `"${r.role_id}"`).join(" | ");

  const content = `/**
 * better-auth Instance
 * Implements spec section: development_standards (auth_mechanism: jwt_bearer, roles)
 *
 * Configures email/password auth with role-based access control.
 * Roles defined in spec: ${roles.map((r) => r.role_id).join(", ")}
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema/auth";
import { ROLE_IDS, type RoleId } from "./roles";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes client-side cache
    },
  },
  user: {
    additionalFields: {
      // Role field — one of: ${roles.map((r) => r.role_id).join(", ")}
      role: {
        type: "string",
        required: true,
        defaultValue: "${roles.find((r) => r.role_id.includes("viewer") || r.role_id.includes("read")) ? roles.find((r) => r.role_id.includes("viewer"))!.role_id : roles[roles.length - 1]?.role_id ?? "viewer"}",
        validator: {
          input: (value: unknown): value is RoleId => ROLE_IDS.includes(value as RoleId),
        },
      },
    },
  },
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;
`;

  return {
    relativePath: "src/lib/auth/index.ts",
    content,
    specIds: ["development_standards"],
    generator: "better-auth-generator",
  };
}

function buildAuthRoles(ctx: GeneratorContext): GeneratedFile {
  const roles = ctx.spec.development_standards.roles;

  const roleConst = roles
    .map((r) => `  /** ${r.name}: ${r.description} */\n  ${r.role_id.toUpperCase().replace(/-/g, "_")}: "${r.role_id}" as const,`)
    .join("\n");

  const roleIdType = roles.map((r) => `"${r.role_id}"`).join(" | ");
  const roleIdArray = roles.map((r) => `"${r.role_id}"`).join(", ");

  const permissionsBlock = roles
    .map(
      (r) =>
        `  "${r.role_id}": [${r.permissions.map((p) => `"${p}"`).join(", ")}],`
    )
    .join("\n");

  const content = `/**
 * Role Definitions
 * Implements spec section: development_standards.roles
 *
 * Roles: ${roles.map((r) => `${r.role_id} (${r.name})`).join(", ")}
 */

export const ROLES = {
${roleConst}
} as const;

export type RoleId = ${roleIdType};

/** Array of all valid role IDs — used for validation */
export const ROLE_IDS: RoleId[] = [${roleIdArray}];

/**
 * Permissions by role.
 * Sourced from spec development_standards.roles[].permissions
 */
export const ROLE_PERMISSIONS: Record<RoleId, string[]> = {
${permissionsBlock}
};

/**
 * Returns true if a role has a given permission.
 *
 * @param role - The user's role ID
 * @param permission - Permission string to check
 * @returns true if the role has the permission
 */
export function hasPermission(role: RoleId, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
`;

  return {
    relativePath: "src/lib/auth/roles.ts",
    content,
    specIds: ["development_standards"],
    generator: "better-auth-generator",
  };
}

function buildAuthClient(ctx: GeneratorContext): GeneratedFile {
  const content = `/**
 * better-auth Client
 * Import this in Client Components for signIn, signOut, useSession.
 */

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL,
});

export const { signIn, signOut, useSession, getSession } = authClient;
`;

  return {
    relativePath: "src/lib/auth/client.ts",
    content,
    specIds: ["development_standards"],
    generator: "better-auth-generator",
  };
}

function buildAuthRoute(): GeneratedFile {
  const content = `/**
 * better-auth Route Handler — catches all /api/auth/* routes.
 * Implements spec section: development_standards (auth_mechanism: jwt_bearer)
 */

import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
`;

  return {
    relativePath: "src/app/api/auth/[...all]/route.ts",
    content,
    specIds: ["development_standards"],
    generator: "better-auth-generator",
  };
}
