// src/app/robots.ts
// robots.txt — control which routes search engines can index.

import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/env/public";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteOrigin() ?? "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/home",
          "/messages",
          "/saved",
          "/notifications",
          "/settings",
          "/api/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}