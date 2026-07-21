import { MatchForm } from "@/components/match-form";
import { NotJoined } from "@/components/not-joined";
import { PageHeader } from "@/components/page-header";
import { viewerForPrivateRead } from "@/services/auth/authz";
import { getDb } from "@/services/db";
import { listActivePlayers } from "@/services/players";

export default async function LogMatchPage() {
  // Gate before the query — the roster is private data too.
  const access = await viewerForPrivateRead();
  if (!access) return <NotJoined />;

  const you = access.player;
  const roster = await listActivePlayers(getDb());

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader kicker="New match" title="Log Match" />

      {you ? (
        <MatchForm
          roster={roster.map(({ id, name }) => ({ id, name }))}
          loggerId={you.id}
        />
      ) : (
        // Only reachable as an unbound Admin: every Match records a Player
        // Logger, so an Admin session alone can't log one (spec decision 49).
        <section className="border p-4">
          <h2 className="font-display text-[26px] leading-[1.1] uppercase">
            Who&apos;s logging?
          </h2>
          <p className="mt-2 text-[15px] leading-normal font-semibold text-muted-foreground">
            This device isn&apos;t joined as a player, so a match logged here
            couldn&apos;t be credited to anyone. Join with an invite link to
            log matches.
          </p>
        </section>
      )}
    </main>
  );
}
