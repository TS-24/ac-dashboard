import { NextResponse } from "next/server";

import { listCards } from "../../../lib/cards/card-service.ts";

export async function GET() {
  try {
    return NextResponse.json({ items: await listCards() });
  } catch (error) {
    return NextResponse.json({ error: { code: "CARDS_UNAVAILABLE", message: error instanceof Error ? error.message : "Cards unavailable" } }, { status: 503 });
  }
}
