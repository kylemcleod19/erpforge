import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Only required for drizzle-kit migrate/push/pull.
    // drizzle-kit generate works without a live database.
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/erpforge",
  },
});
