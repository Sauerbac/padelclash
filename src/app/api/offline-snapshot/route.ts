import { NextResponse } from "next/server";
import { currentBinding } from "@/services/auth/binding";
import { getDb } from "@/services/db";
import { listActivePlayers } from "@/services/players";

export async function GET() {
  const binding = await currentBinding();
  if (!binding) {
    return NextResponse.json(
      { error: "Player binding required" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const roster = await listActivePlayers(getDb());
  return NextResponse.json(
    {
      player: { id: binding.player.id, name: binding.player.name },
      roster: roster.map(({ id, name }) => ({ id, name })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
