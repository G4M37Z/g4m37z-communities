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
  keywords: [
    "gaming",
    "communities",
    "esports",
    "PlayStation",
    "Xbox",
    "PC gaming",
    "mobile gaming",
    "forum",
    "social",
  ],
  authors: [{ name: "G4M37Z" }],
  creator: "G4M37Z",
  publisher: "G4M37Z",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "G4M37Z Communities",
    title: "G4M37Z Communities — Where gamers gather",
    description:
      "Discover gaming communities, share posts, and connect with players across every platform.",
    images: [
      {
        url: "/icon.svg",
        width: 1200,
        height: 630,
        alt: "G4M37Z Communities",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "G4M37Z Communities — Where gamers gather",
    description:
      "Discover gaming communities, share posts, and connect with players across every platform.",
    images: ["/icon.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
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
