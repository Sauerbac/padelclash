import { NextResponse } from "next/server";
import { pingDb } from "@/services/health";

// Always hit the database; never serve a cached health result.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pingDb();
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
