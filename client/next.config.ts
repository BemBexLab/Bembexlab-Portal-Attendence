import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

// Load the repository-level .env for local development while keeping Vercel's
// project environment variables as the production source.
loadEnvConfig(path.resolve(process.cwd(), ".."));

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    const apiUrl = (
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:4000"
    ).replace(/\/$/, "");

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
