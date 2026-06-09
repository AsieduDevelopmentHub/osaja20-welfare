import type { NextConfig } from "next";
import { nextSecurityHeaders } from "@osaja/config";

const unstableDevCache =
  process.platform === "win32" || process.cwd().includes("OneDrive");

const nextConfig: NextConfig = {
  transpilePackages: ["@osaja/config", "@osaja/ui"],
  experimental: {
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    },
  },
  webpack: (config, { dev }) => {
    if (dev && unstableDevCache) {
      config.cache = false;
    }
    return config;
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [...nextSecurityHeaders],
      },
    ];
  },
};

export default nextConfig;
