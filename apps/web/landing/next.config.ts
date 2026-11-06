import type { NextConfig } from "next";
import { nextSecurityHeaders } from "@osaja/config";

const unstableDevCache =
  process.platform === "win32" || process.cwd().includes("OneDrive");
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000";

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
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
    ];
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
