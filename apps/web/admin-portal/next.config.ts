import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@osaja/types", "@osaja/utils", "@osaja/config"],
};

export default nextConfig;
