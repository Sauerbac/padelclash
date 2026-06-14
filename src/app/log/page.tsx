import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlayerId } from "@/auth";
import { getRoster, listMemberGroups } from "@/services/groups";
import { GroupHeader } from "@/app/_shell/GroupHeader";
import { LogMatchForm } from "./LogMatchForm";

export const metadata: Metadata = {
  title: "Log a match · PadelClash",
};

// Reads the live session + roster, so it must stay dynamic.
export const dynamic = "force-dynamic";

// The Log tab (screens.md §3 — the heartbeat interaction). Group-scoped routing is
// deferred (open-question 06), so — like Home — this resolves the viewer into their
// first group and logs there. A multi-group "log into which group?" picker arrives
// with the switcher.
export default async function LogMatchPage() {
  const playerId = await requirePlayerId();
  const groups = await listMemberGroups(playerId);
  if (groups.length === 0) redirect("/groups/new");

  const group = groups[0];
  const roster = await getRoster(group.id);
  const players = roster.map((m) => ({ playerId: m.playerId, name: m.name }));

  return (
    <>
      <GroupHeader name={group.name} />
      <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-6 pt-6 pb-24">
        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-meta font-bold uppercase tracking-wide text-secondary">
            Log a match
          </h2>

          {players.length < 2 ? (
            <div className="flex flex-col gap-3 rounded-card border-bold border-ink bg-surface px-5 py-8 text-center">
              <p className="font-display text-title text-ink">
                Add a player first
              </p>
              <p className="font-body text-body text-secondary">
                A match needs two sides. Add at least one opponent on the board,
                then come back to log.
              </p>
              <Link
                href={`/groups/${group.id}`}
                className="font-body text-body font-bold text-primary underline"
              >
                Go to the board
              </Link>
            </div>
          ) : (
            <LogMatchForm groupId={group.id} players={players} />
          )}
        </section>
      </main>
    </>
  );
}
