import { NextResponse } from "next/server";

import { syncAssignments } from "../../../../lib/tasks/sync-assignments.ts";

export async function POST() {
  try {
    return NextResponse.json(await syncAssignments());
  } catch (error) {
    return NextResponse.json({ error: { code: "SYNC_FAILED", message: error instanceof Error ? error.message : "Assignment sync failed" } }, { status: 502 });
  }
}
