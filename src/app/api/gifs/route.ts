import { NextResponse } from "next/server";
import { searchGifs } from "@/lib/messaging/gifs";
import { createClient } from "@/lib/supabase/server";

// src/app/api/gifs/route.ts — server proxy for Tenor GIF search.
// Authenticated users only; the TENOR_API_KEY stays server-side.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.length > 80) {
    return NextResponse.json({ error: "Query too long." }, { status: 400 });
  }

  const result = await searchGifs(q, { limit: 20 });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, reason: result.reason },
      { status: result.reason === "no-key" ? 501 : 502 },
    );
  }
  return NextResponse.json({ gifs: result.gifs });
}
