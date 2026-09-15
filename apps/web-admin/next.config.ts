import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.5.50.43"],
  transpilePackages: ["@safaar/types"],
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: "https://api.safaar.uz/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
