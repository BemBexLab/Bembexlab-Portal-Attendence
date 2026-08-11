import type { NextConfig } from "next";

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
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
