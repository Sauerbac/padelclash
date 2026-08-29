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

export type RosterStatus =
  | { kind: "live" }
  | { kind: "checking" }
  | { kind: "saved"; refreshedAt: Date }
  | { kind: "missing" };

export function LogMatchView({
  roster,
  reservedPlayerNames,
  logger,
  sharedMatchCounts,
  initialDraft,
  initialDraftNamesByPlayerId,
  actions,
  rosterStatus,
}: {
  roster: RosterPlayer[];
  reservedPlayerNames: string[];
  logger: RosterPlayer | null;
  sharedMatchCounts?: SharedMatchCounts;
  initialDraft?: MatchFormDraft;
  initialDraftNamesByPlayerId?: Record<string, string>;
  actions?: MatchFormActions;
  rosterStatus?: RosterStatus;
}) {
  const status = rosterStatus ?? { kind: "live" as const };
  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader kicker="New match" title="Log Match" />

      {(status.kind === "checking" || status.kind === "saved") && (
        <p role="status" className="font-mono text-[11px] font-semibold tracking-[1px] text-muted-foreground uppercase">
          {status.kind === "checking"
            ? "Checking for roster updates…"
            : `Using saved roster from ${status.refreshedAt.toLocaleString()}`}
        </p>
      )}

      {status.kind === "missing" ? (
        <section className="border p-4">
          <h2 className="font-display text-[26px] uppercase">Roster needed</h2>
          <p className="mt-2 font-semibold text-muted-foreground">Open Log Match once while the server is reachable before logging without it.</p>
        </section>
      ) : logger ? (
        <MatchForm
          roster={roster}
          reservedPlayerNames={reservedPlayerNames}
          loggerId={logger.id}
          sharedMatchCounts={sharedMatchCounts}
          initialDraft={initialDraft}
          initialDraftNamesByPlayerId={initialDraftNamesByPlayerId}
          actions={actions}
          draftContinuity="fresh"
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
