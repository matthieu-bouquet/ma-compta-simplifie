import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  // Allow running `next dev` concurrently (ex: dev + Playwright webServer)
  // by isolating Next's build/cache directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
