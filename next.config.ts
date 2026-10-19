import type { NextConfig } from "next";
import { assertBuildEnv } from "./src/lib/env/build.ts";

// Build-boundary configuration validation (names only, never values).
// Malformed values fail the build; missing optional integrations warn.
// See src/lib/env/build.ts and docs/ENVIRONMENT_VARIABLES.md.
assertBuildEnv(process.env);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Voice features need camera/mic within the app frame only.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), autoplay=(self)" },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow FormData uploads up to 8MB so avatar + image posts work.
      // Default is 1MB.
      bodySizeLimit: "8mb",
    },
  },
  // Allow image domains for next/image (safety for future use).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "g4m37z-communities.vercel.app" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
