import { type NextRequest } from "next/server";

/**
 * Team logos, league badges and whale avatars, served from our own domain.
 *
 * These used to go through Vercel's image optimizer (/_next/image). That has a
 * monthly quota on our plan, and once it ran out (2026-10-23) every image it
 * had not cached yet answered 402 — new NBA logos fell back to letter badges.
 * The sources are small PNG/JPEG files already sized for a crest, so they are
 * passed through as they are and cached at the CDN for a year: one fetch per
 * file, ever, and still nothing loads from a foreign host in the browser
 * (which is the point for visitors in Iran).
 *
 * Only the hosts next.config already trusts are allowed.
 */
const ALLOWED = [/^https:\/\/polymarket-upload\.s3\.us-east-2\.amazonaws\.com\//, /^https:\/\/cdn-api\.pandascore\.co\/images\//, /^https:\/\/a\.espncdn\.com\/i\/teamlogos\//];
const MAX_BYTES = 2_000_000;

/**
 * Polymarket writes spaces in some S3 keys as "+" ("NBA+Team+Logos/CHI.png").
 * S3 reads a literal "+" in a path as a space, but once the URL is re-encoded
 * the "+" becomes %2B and S3 answers 403. Spaces are what was meant.
 */
function logoSource(raw: string): string {
  return raw.replace(/\+/g, "%20");
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  if (!ALLOWED.some((re) => re.test(u))) return new Response("not allowed", { status: 400 });
  const res = await fetch(logoSource(u), { cache: "force-cache" }).catch(() => null);
  if (!res || !res.ok) return new Response("not found", { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" } });
  const type = res.headers.get("content-type") ?? "";
  if (!/^image\/(png|jpe?g|webp|gif|avif)$/.test(type)) return new Response("not an image", { status: 415 });
  const body = await res.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return new Response("too large", { status: 413 });
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
