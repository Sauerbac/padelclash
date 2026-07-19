import { MatchForm } from "@/components/match-form";
import { PageHeader } from "@/components/page-header";
import { getBoundPlayer } from "@/services/auth/binding";
import { getDb } from "@/services/db";
import { listActivePlayers } from "@/services/players";

export default async function LogMatchPage() {
  const db = getDb();
  const [you, roster] = await Promise.all([
    getBoundPlayer(),
    listActivePlayers(db),
  ]);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader kicker="New match" title="Log Match" />

      {you ? (
        <MatchForm
          roster={roster.map(({ id, name }) => ({ id, name }))}
          loggerId={you.id}
        />
      ) : (
        <section className="border p-4">
          <h2 className="font-display text-[26px] leading-[1.1] uppercase">
            Who&apos;s logging?
          </h2>
          <p className="mt-2 text-[15px] leading-normal font-semibold text-muted-foreground">
            This device isn&apos;t bound to a player yet, so matches can&apos;t
            be credited. Open your personal join link first — or ask the group
            admin for one.
          </p>
        </section>
      )}
    </main>
  );
}
