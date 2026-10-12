import type { NextConfig } from "next";

const backendUrl =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.safaar.uz/v1";

const normalizedBackendUrl = backendUrl.endsWith("/v1")
  ? backendUrl
  : `${backendUrl.replace(/\/+$/, "")}/v1`;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.5.50.43"],
  transpilePackages: ["@safaar/types"],
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${normalizedBackendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
