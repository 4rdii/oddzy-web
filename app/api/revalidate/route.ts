import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { LOCALES } from "@/lib/i18n";

/**
 * On-demand ISR invalidation, called by the bot when a basket changes status.
 *
 * WHY THIS EXISTS: publishing a basket did not make its page appear. Basket
 * pages are ISR with `revalidate = 3600`, and anything that touched the URL
 * while the basket was still a draft cached a `notFound()` for the full hour.
 * That is not a rare race — the content agent posts the basket link to the
 * channel seconds after publishing, and Telegram fetches a link preview, so the
 * 404 gets cached against the exact link being broadcast. It happened on
 * today-picks-2026-08-31.
 *
 * Invalidating on the publish itself is the only fix that closes the window
 * rather than shortening it.
 *
 * Auth is a shared secret compared in constant time. Without it this is a free
 * cache-eviction endpoint for anyone who finds it — not catastrophic, but a
 * cheap way to make every basket page miss on every request.
 */
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  // Same length check first, then a constant-time-ish compare. Web Crypto has no
  // timingSafeEqual in this runtime, so this is the honest approximation.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    // Absent secret disables the endpoint rather than opening it.
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { slug?: unknown };
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) {
    return NextResponse.json({ error: "bad_slug" }, { status: 400 });
  }

  // Both locales: each brand renders its own path, and a publish affects both.
  // The listing pages too — a new basket changes what /baskets and the sitemap
  // should contain, and leaving those stale is the same bug one level up.
  const paths: string[] = [];
  for (const lang of LOCALES) {
    paths.push(`/${lang}/baskets/${slug}`, `/${lang}/baskets`);
  }
  paths.push("/sitemap.xml");

  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // One bad path must not stop the rest — the basket page is the one that
      // matters and it is first.
    }
  }

  return NextResponse.json({ ok: true, revalidated: paths });
}
