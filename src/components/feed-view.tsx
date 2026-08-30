import Image from "next/image";
import { canModifyMatch } from "@/domain/edit-rights";
import { MatchCard } from "@/components/match-card";
import { PageHeader } from "@/components/page-header";
import {
  PullToRefresh,
  type PullIndicatorPhase,
} from "@/components/pull-to-refresh";
import { QueuedMatches } from "@/components/queued-matches";
import type { FeedMatch } from "@/services/matches";
import { ConnectionStatus } from "@/components/connection-status";
import { PlayerNavigationProvider } from "@/components/player-navigation-context";

/**
 * The Feed screen, rendered from props alone (decision 127). `FeedPage` keeps
 * the auth check and the query; everything from the identity line down lives
 * here, so the empty feed, the Admin viewer and the edit-rights window are all
 * reachable in the gallery without a database.
 *
 * `now` is a prop rather than a `new Date()` inside, because the 24-hour grace
 * window is exactly what decides whether the edit and delete affordances
 * appear — a case has to be able to sit on either side of it.
 */
export function FeedView({
  you,
  isAdmin,
  feed,
  now,
  /**
   * The offline queue section. Defaults to the real IndexedDB-backed component;
   * only the gallery passes anything, and it passes fixture cards, because the
   * gallery must not read live device state any more than it reads the
   * database.
   */
  queued = <QueuedMatches />,
  pullToRefreshPhase,
  savedAt,
  playerConnectionExplanationPreview,
}: {
  /** The Player bound to this device, or null for an Admin browsing unbound. */
  you: { id: string; name: string } | null;
  isAdmin: boolean;
  feed: FeedMatch[];
  now: Date;
  queued?: React.ReactNode;
  /** Fixture-only phase pin; production leaves the gesture interactive. */
  pullToRefreshPhase?: PullIndicatorPhase;
  /** Read-only projection fallback; fresh production views leave this unset. */
  savedAt?: Date;
  /** Gallery-only pin for the Saved View Player-link explanation. */
  playerConnectionExplanationPreview?: boolean;
}) {
  const viewer = { playerId: you?.id ?? null, isAdmin };

  return (
    <PlayerNavigationProvider
      needsConnection={Boolean(savedAt)}
      explanationPreview={playerConnectionExplanationPreview}
    >
    <PullToRefresh previewPhase={pullToRefreshPhase}>
      <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
        <PageHeader
          kicker="Your club. Your receipts."
          title="PadelClash"
          actions={
            <div className="size-18 shrink-0" aria-hidden>
              <Image
                src="/logo.svg"
                alt=""
                width={72}
                height={72}
                priority
                unoptimized
                className="size-full"
              />
            </div>
          }
        />

        {savedAt && <ConnectionStatus refreshedAt={savedAt} showRetry />}

        {you ? (
          <p className="text-[15px] font-semibold text-muted-foreground">
            Logging as <span className="text-accent uppercase">{you.name}</span>{" "}
            — new matches from this device are credited to you.
          </p>
        ) : (
          // The only way to be here unbound is an Admin session browsing past
          // the read gate (spec decision 49) — and Admin can't log a match.
          <p className="text-[15px] font-semibold text-muted-foreground">
            Viewing as admin. Logging a match needs a joined player on this
            device.
          </p>
        )}

        {queued}

        {feed.length === 0 ? (
          <p className="text-[15px] font-semibold text-muted-foreground">
            No matches yet — log the first one.
          </p>
        ) : (
          <div className="space-y-3">
            {feed.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                canModify={!savedAt && canModifyMatch(match, viewer, now)}
                showLogger={isAdmin}
              />
            ))}
          </div>
        )}
      </main>
    </PullToRefresh>
    </PlayerNavigationProvider>
  );
}
