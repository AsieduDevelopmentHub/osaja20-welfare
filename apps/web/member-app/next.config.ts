import type { NextConfig } from "next";
import { nextSecurityHeaders } from "@osaja/config";

const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000";

const unstableDevCache =
  process.platform === "win32" || process.cwd().includes("OneDrive");

const nextConfig: NextConfig = {
  transpilePackages: ["@osaja/types", "@osaja/utils", "@osaja/config", "@osaja/ui"],
  // @osaja/* packages use NodeNext imports (e.g. ./dues.js → dues.ts)
  experimental: {
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    },
  },
  webpack: (config, { dev }) => {
    // OneDrive + Windows often corrupts .next/cache pack files → random 500s
    if (dev && unstableDevCache) {
      config.cache = false;
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/uploads/**" },
      { protocol: "https", hostname: "**", pathname: "/uploads/**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${apiProxyTarget}/uploads/:path*`,
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
