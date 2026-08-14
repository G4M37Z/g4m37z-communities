import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "G4M37Z Communities — Where gamers gather",
    template: "%s · G4M37Z Communities",
  },
  description:
    "Discover gaming communities, share posts, and connect with players across every platform.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-bg font-sans text-fg antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer user={user} />
      </body>
    </html>
  );
}
