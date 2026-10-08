import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

// Load the repository-level .env for local development while keeping Vercel's
// project environment variables as the production source.
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
      {
        source: "/socket.io/:path*",
        destination: `${apiUrl}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
