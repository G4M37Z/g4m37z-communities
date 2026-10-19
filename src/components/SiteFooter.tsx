// src/components/SiteFooter.tsx
// Server wrapper around Footer for pages that own it (landing, auth, legal),
// so the root layout stays footer-free and app surfaces (messages, feed,
// settings) don't grow trailing link columns.

import { Footer } from "@/components/Footer";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function SiteFooter() {
  const { user } = await getCurrentUser();
  return <Footer user={user} />;
}
