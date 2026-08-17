import type { NextConfig } from "next";

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
};

export default nextConfig;
