// src/app/api/client-error/route.ts
// Receives client-side crash beacons (instrumentation-client.ts,
// global-error.tsx, error.tsx) and writes them to console.error so they
// appear in Vercel function logs. Unauthenticated by design (crashes must
// be reportable before auth works); body is size-capped and truncated.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const raw = (await request.text()).slice(0, 8000);
    let rendered = raw;
    try {
      rendered = JSON.stringify(JSON.parse(raw)).slice(0, 4000);
    } catch {
      // keep the raw (truncated) body
    }
    console.error("[client-error]", rendered);
  } catch (err) {
    console.error("[client-error:unreadable]", String(err));
  }
  return new Response(null, { status: 204 });
}
