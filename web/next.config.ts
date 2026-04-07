import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a standalone build suitable for Railway deployment.
  // The output at .next/standalone/server.js is a self-contained Node.js server.
  output: "standalone",

  // These packages use Node.js-only APIs and must not be bundled by webpack.
  serverExternalPackages: ["postgres", "pino", "pino-pretty"],

  eslint: {
    // Lint is run separately in CI; don't block builds on lint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
