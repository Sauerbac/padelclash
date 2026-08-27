import { NextResponse } from "next/server";
import { currentBinding } from "@/services/auth/binding";
import { getDb } from "@/services/db";
import { getSharedMatchCounts } from "@/services/matches";
import { listPlayers } from "@/services/players";

export async function GET() {
  const binding = await currentBinding();
  if (!binding) {
    return NextResponse.json(
      { error: "Player binding required" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const db = getDb();
  const [allPlayers, sharedMatchCounts] = await Promise.all([
    listPlayers(db),
    getSharedMatchCounts(db, binding.player.id),
  ]);
  const roster = allPlayers.filter((player) => player.retiredAt === null);
  return NextResponse.json(
    {
      player: { id: binding.player.id, name: binding.player.name },
      roster: roster.map(({ id, name }) => ({ id, name })),
      reservedPlayerNames: allPlayers.map(({ name }) => name),
      sharedMatchCounts,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
