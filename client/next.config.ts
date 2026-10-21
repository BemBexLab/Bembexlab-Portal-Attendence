import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

// Load the repository-level .env for Next config values in local development.
// Auth code also loads this file in its request worker.
loadEnvConfig(path.resolve(process.cwd(), ".."));

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    const configuredApiUrl = process.env.API_URL?.trim();

    if (process.env.NODE_ENV === "production" && !configuredApiUrl) {
      throw new Error(
        "API_URL must be set to the public VPS API origin for production builds.",
      );
    }

    const apiUrl = (configuredApiUrl || "http://localhost:4000").replace(
      /\/$/,
      "",
    );

    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
