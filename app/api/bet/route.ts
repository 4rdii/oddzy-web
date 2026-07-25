import { NextResponse } from "next/server";

/**
 * POST /api/bet — place a bet.
 *
 * Not implemented yet. Placement must go through the bot's order-signing path
 * (bet lock → CLOB creds → executor → picks row → rev-share accrual); this
 * route will forward an authenticated request to that endpoint once it exists
 * on the bot server. Until then it answers 501 so the UI can say "not wired
 * up" instead of fabricating a receipt for a bet nobody placed.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "not_implemented",
      message: "Betting from the web app isn't live yet — place this bet in the Telegram bot.",
    },
    { status: 501 },
  );
}
