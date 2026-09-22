import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  // Allow running `next dev` concurrently (ex: dev + Playwright webServer)
  // by isolating Next's build/cache directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Document uploads use Server Actions; default Next limit is 1 MB (see documentsStorage 20 MB).
  experimental: {
    serverActions: {
      bodySizeLimit: "21mb",
    },
  },
};

export default nextConfig;
