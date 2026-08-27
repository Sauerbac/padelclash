import { MatchForm } from "@/components/match-form";
import type {
  MatchFormActions,
  MatchFormDraft,
} from "@/components/match-form";
import { PageHeader } from "@/components/page-header";
import type { SharedMatchCounts } from "@/lib/player-roster";

interface RosterPlayer {
  id: string;
  name: string;
}

export function LogMatchView({
  roster,
  reservedPlayerNames,
  logger,
  sharedMatchCounts,
  initialDraft,
  actions,
}: {
  roster: RosterPlayer[];
  reservedPlayerNames: string[];
  logger: RosterPlayer | null;
  sharedMatchCounts?: SharedMatchCounts;
  initialDraft?: MatchFormDraft;
  actions?: MatchFormActions;
}) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader kicker="New match" title="Log Match" />

      {logger ? (
        <MatchForm
          roster={roster}
          reservedPlayerNames={reservedPlayerNames}
          loggerId={logger.id}
          sharedMatchCounts={sharedMatchCounts}
          initialDraft={initialDraft}
          actions={actions}
        />
      ) : (
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
