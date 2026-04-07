import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a standalone build suitable for Railway deployment.
  output: "standalone",

  // These packages use Node.js-only APIs and must not be bundled by webpack.
  serverExternalPackages: ["postgres", "pino"],

  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack(config) {
    // The interviewer/ and dev-agent/ packages use the TypeScript convention of
    // writing imports with .js extensions (e.g. `from "./session.js"`), which is
    // correct for ESM TypeScript but requires webpack to resolve .js → .ts.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
