import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@osaja/types", "@osaja/utils", "@osaja/config", "@osaja/ui"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/uploads/**" },
      { protocol: "https", hostname: "**", pathname: "/uploads/**" },
    ],
  },
};

export default nextConfig;
