import type { NextConfig } from "next";
import { DOCUMENT_UPLOAD_SERVER_ACTION_BODY_SIZE_LIMIT } from "./src/lib/documentUploadLimits";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  // Allow running `next dev` concurrently (ex: dev + Playwright webServer)
  // by isolating Next's build/cache directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      bodySizeLimit: DOCUMENT_UPLOAD_SERVER_ACTION_BODY_SIZE_LIMIT,
    },
  },
};

export default nextConfig;
