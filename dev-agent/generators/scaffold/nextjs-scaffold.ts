/**
 * ERP Forge Dev Agent — Next.js Scaffold Generator
 *
 * Generates the static project files for a Next.js 15 App Router ERP platform.
 * Rule-based — no AI calls.
 */

import type { GeneratorContext, GeneratedFile } from "../../types.js";
import { writePlatformFile } from "../../spec-manager.js";

/**
 * Generates all static Next.js scaffold files:
 * package.json, next.config.ts, tsconfig.json, tailwind.config.ts, drizzle.config.ts,
 * and the lib/api utility layer (handler, response, pagination, errors).
 *
 * @param ctx - Generator context with spec and platform directory
 * @returns List of generated files
 */
export function generateNextjsScaffold(ctx: GeneratorContext): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // package.json
  const pkg = buildPackageJson(ctx);
  writePlatformFile(ctx.platformDir, "package.json", pkg.content);
  files.push(pkg);

  // next.config.ts
  const nextConfig = buildNextConfig();
  writePlatformFile(ctx.platformDir, "next.config.ts", nextConfig.content);
  files.push(nextConfig);

  // tsconfig.json
  const tsConfig = buildTsConfig();
  writePlatformFile(ctx.platformDir, "tsconfig.json", tsConfig.content);
  files.push(tsConfig);

  // tailwind.config.ts
  const tailwind = buildTailwindConfig();
  writePlatformFile(ctx.platformDir, "tailwind.config.ts", tailwind.content);
  files.push(tailwind);

  // drizzle.config.ts
  const drizzle = buildDrizzleConfig();
  writePlatformFile(ctx.platformDir, "drizzle.config.ts", drizzle.content);
  files.push(drizzle);

  // src/app/globals.css
  const globals = buildGlobalsCss();
  writePlatformFile(ctx.platformDir, "src/app/globals.css", globals.content);
  files.push(globals);

  // src/app/layout.tsx (root layout)
  const rootLayout = buildRootLayout(ctx);
  writePlatformFile(ctx.platformDir, "src/app/layout.tsx", rootLayout.content);
  files.push(rootLayout);

  // src/app/page.tsx (root redirect)
  const rootPage = buildRootPage();
  writePlatformFile(ctx.platformDir, "src/app/page.tsx", rootPage.content);
  files.push(rootPage);

  // src/app/(auth)/layout.tsx
  const authLayout = buildAuthLayout();
  writePlatformFile(ctx.platformDir, "src/app/(auth)/layout.tsx", authLayout.content);
  files.push(authLayout);

  // lib/api utilities
  const libFiles = buildLibApi();
  for (const f of libFiles) {
    writePlatformFile(ctx.platformDir, f.relativePath, f.content);
    files.push(f);
  }

  // scripts/migrate.ts
  const migrate = buildMigrateScript();
  writePlatformFile(ctx.platformDir, "scripts/migrate.ts", migrate.content);
  files.push(migrate);

  return files;
}

function buildPackageJson(ctx: GeneratorContext): GeneratedFile {
  const name = ctx.customerSlug.replace(/[^a-z0-9-]/g, "-");
  const content = JSON.stringify(
    {
      name,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
        "db:generate": "drizzle-kit generate",
        "db:migrate": "npx tsx scripts/migrate.ts",
        "db:seed": "npx tsx db/seed.ts",
        "db:studio": "drizzle-kit studio",
        test: "vitest",
      },
      dependencies: {
        next: "^15.0.0",
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        "drizzle-orm": "^0.39.0",
        postgres: "^3.4.0",
        "better-auth": "^1.2.0",
        "@anthropic-ai/sdk": "^0.54.0",
        "openid-client": "^6.1.0",
        "node-cron": "^3.0.0",
        "react-hook-form": "^7.54.0",
        "@hookform/resolvers": "^3.10.0",
        zod: "^3.24.0",
        "tailwindcss-animate": "^1.0.7",
        "class-variance-authority": "^0.7.1",
        clsx: "^2.1.1",
        "tailwind-merge": "^2.6.0",
        "lucide-react": "^0.469.0",
        "@radix-ui/react-slot": "^1.1.1",
      },
      devDependencies: {
        typescript: "^5.7.0",
        "@types/node": "^22.0.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "@types/node-cron": "^3.0.11",
        "drizzle-kit": "^0.30.0",
        tailwindcss: "^3.4.0",
        autoprefixer: "^10.4.0",
        postcss: "^8.5.0",
        tsx: "^4.19.0",
        vitest: "^2.1.0",
        "@vitejs/plugin-react": "^4.3.0",
      },
    },
    null,
    2
  );

  return {
    relativePath: "package.json",
    content,
    specIds: ["development_standards"],
    generator: "nextjs-scaffold",
  };
}

function buildNextConfig(): GeneratedFile {
  const content = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone" enables Railway deployment with minimal image size
  output: "standalone",
  serverExternalPackages: ["postgres"],
  experimental: {
    // Server Actions are stable in Next.js 15 — no flag needed
  },
};

export default nextConfig;
`;
  return {
    relativePath: "next.config.ts",
    content,
    specIds: ["development_standards"],
    generator: "nextjs-scaffold",
  };
}

function buildTsConfig(): GeneratedFile {
  const content = JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: {
          "@/*": ["./src/*"],
        },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    },
    null,
    2
  );
  return {
    relativePath: "tsconfig.json",
    content,
    specIds: ["development_standards"],
    generator: "nextjs-scaffold",
  };
}

function buildTailwindConfig(): GeneratedFile {
  const content = `import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
    },
  },
  plugins: [tailwindAnimate],
};

export default config;
`;
  return {
    relativePath: "tailwind.config.ts",
    content,
    specIds: ["development_standards"],
    generator: "nextjs-scaffold",
  };
}

function buildDrizzleConfig(): GeneratedFile {
  const content = `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
`;
  return {
    relativePath: "drizzle.config.ts",
    content,
    specIds: ["development_standards"],
    generator: "nextjs-scaffold",
  };
}

function buildGlobalsCss(): GeneratedFile {
  const content = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
`;
  return {
    relativePath: "src/app/globals.css",
    content,
    specIds: ["development_standards"],
    generator: "nextjs-scaffold",
  };
}

function buildRootLayout(ctx: GeneratorContext): GeneratedFile {
  const title = ctx.spec.business_profile.company_name + " ERP";
  const content = `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${title}",
  description: "ERP platform powered by ERP Forge",
};

/**
 * Root layout — minimal wrapper.
 * Authenticated shell is in src/app/(app)/layout.tsx.
 *
 * @param children - Page content
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
  return {
    relativePath: "src/app/layout.tsx",
    content,
    specIds: ["development_standards"],
    generator: "nextjs-scaffold",
  };
}

function buildRootPage(): GeneratedFile {
  const content = `import { redirect } from "next/navigation";

/**
 * Root page — redirects to dashboard if authenticated, otherwise to login.
 * The authenticated shell checks session in (app)/layout.tsx.
 */
export default function RootPage() {
  redirect("/dashboard");
}
`;
  return {
    relativePath: "src/app/page.tsx",
    content,
    specIds: ["development_standards"],
    generator: "nextjs-scaffold",
  };
}

function buildAuthLayout(): GeneratedFile {
  const content = `/**
 * Auth route group layout — no sidebar, centered content.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      {children}
    </div>
  );
}
`;
  return {
    relativePath: "src/app/(auth)/layout.tsx",
    content,
    specIds: ["development_standards"],
    generator: "nextjs-scaffold",
  };
}

function buildLibApi(): GeneratedFile[] {
  return [
    {
      relativePath: "src/lib/api/errors.ts",
      content: `/**
 * API error classes used by service layer and Route Handlers.
 * Import these in services and catch them in Route Handlers to return typed API errors.
 */

export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message: string) { super(message); this.name = "NotFoundError"; }
}

export class ValidationError extends Error {
  readonly status = 422;
  constructor(message: string) { super(message); this.name = "ValidationError"; }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message: string) { super(message); this.name = "ForbiddenError"; }
}

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message: string) { super(message); this.name = "UnauthorizedError"; }
}
`,
      specIds: ["development_standards"],
      generator: "nextjs-scaffold",
    },
    {
      relativePath: "src/lib/api/response.ts",
      content: `/**
 * Standard API response helpers.
 * All ERP Forge Route Handlers return responses through these wrappers
 * to ensure consistent envelope format across all endpoints.
 */

import { NextResponse } from "next/server";

interface OkResponse<T> {
  data: T;
}

interface ErrorResponse {
  error: string;
  details?: unknown;
}

/**
 * Returns a 200 JSON response with data envelope.
 *
 * @param data - Response payload
 * @returns NextResponse with { data } envelope
 */
export function ok<T>(data: T): NextResponse<OkResponse<T>> {
  return NextResponse.json({ data });
}

/**
 * Returns a 201 JSON response for resource creation.
 *
 * @param data - Created resource
 * @returns NextResponse with 201 status and { data } envelope
 */
export function created<T>(data: T): NextResponse<OkResponse<T>> {
  return NextResponse.json({ data }, { status: 201 });
}

/**
 * Returns an error JSON response.
 *
 * @param status - HTTP status code
 * @param message - Human-readable error message
 * @param details - Optional additional details (e.g. Zod field errors)
 * @returns NextResponse with error envelope
 */
export function apiError(
  status: number,
  message: string,
  details?: unknown
): NextResponse<ErrorResponse> {
  return NextResponse.json({ error: message, details }, { status });
}
`,
      specIds: ["development_standards"],
      generator: "nextjs-scaffold",
    },
    {
      relativePath: "src/lib/api/pagination.ts",
      content: `/**
 * Cursor pagination utilities.
 * All ERP Forge list endpoints use cursor pagination (not offset/limit)
 * to support stable pagination on large, frequently-updated ERP datasets.
 */

/**
 * Encodes a cursor value to a URL-safe base64 string.
 *
 * @param value - Value to encode (typically a timestamp or ID)
 * @returns Base64-encoded cursor string
 */
export function encodeCursor(value: string | Date | number): string {
  const str = value instanceof Date ? value.toISOString() : String(value);
  return Buffer.from(str).toString("base64url");
}

/**
 * Decodes a cursor string back to its original string value.
 *
 * @param cursor - Base64-encoded cursor from a previous list response
 * @returns Decoded cursor value, or null if invalid
 */
export function decodeCursor(cursor: string): string | null {
  try {
    return Buffer.from(cursor, "base64url").toString("utf-8");
  } catch {
    return null;
  }
}
`,
      specIds: ["development_standards"],
      generator: "nextjs-scaffold",
    },
    {
      relativePath: "src/lib/api/handler.ts",
      content: `/**
 * Route Handler auth wrapper.
 * Wraps Next.js Route Handlers with better-auth session checking.
 * Every protected Route Handler must use withAuth().
 */

import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError } from "./response";

interface Session {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

type HandlerFn = (
  request: NextRequest,
  ctx: { session: Session },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  routeContext?: any
) => Promise<NextResponse>;

/**
 * Wraps a Route Handler with authentication.
 * Returns 401 if no valid session is found.
 *
 * @param handler - Async Route Handler function receiving (request, { session })
 * @returns Wrapped Route Handler compatible with Next.js App Router
 */
export function withAuth(handler: HandlerFn) {
  return async (request: NextRequest, routeContext?: unknown) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return apiError(401, "Unauthorized");
    }
    return handler(request, { session: session as Session }, routeContext);
  };
}
`,
      specIds: ["development_standards"],
      generator: "nextjs-scaffold",
    },
  ];
}

function buildMigrateScript(): GeneratedFile {
  const content = `/**
 * Database migration script — runs pending Drizzle migrations.
 * Executed on Railway deploy via railway.toml startCommand:
 *   node scripts/migrate.ts && next start
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Error: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

// Use a separate migration-only connection (max 1 connection)
const migrationClient = postgres(connectionString, { max: 1 });
const db = drizzle(migrationClient);

async function main() {
  console.log("Running database migrations...");
  const migrationsFolder = path.join(process.cwd(), "drizzle", "migrations");
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete.");
  await migrationClient.end();
}

main().catch((error: Error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
`;
  return {
    relativePath: "scripts/migrate.ts",
    content,
    specIds: ["development_standards"],
    generator: "nextjs-scaffold",
  };
}
