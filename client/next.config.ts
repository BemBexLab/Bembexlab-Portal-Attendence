import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

const DEFAULT_API_URL = "http://203.161.44.35:4001";

// Load the repository-level .env for Next config values in local development.
// Auth code also loads this file in its request worker.
loadEnvConfig(path.resolve(process.cwd(), ".."), undefined, undefined, true);

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    const configuredApiUrl = process.env.API_URL?.trim();
    const apiUrl = (configuredApiUrl || DEFAULT_API_URL).replace(/\/$/, "");

    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
