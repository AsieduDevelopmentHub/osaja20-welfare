import type { NextConfig } from "next";

const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000";

const unstableDevCache =
  process.platform === "win32" || process.cwd().includes("OneDrive");

const nextConfig: NextConfig = {
  transpilePackages: ["@osaja/types", "@osaja/utils", "@osaja/config", "@osaja/ui"],
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
};

export default nextConfig;
