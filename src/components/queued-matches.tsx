"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  MatchHeadline,
  MatchPlayerNames,
  PlayedAt,
  SetsRow,
  setScores,
} from "@/components/match-card-parts";
import { isPermanentRefusal } from "@/domain/sync-policy";
import {
  QUEUE_CHANGED_EVENT,
  listQueuedMatches,
  removeQueuedMatch,
  type IncompatibleQueuedMatch,
  type QueuedMatch,
  type QueuedMatchRecord,
} from "@/services/offline/queue";

/**
 * "Pending sync" markers in the logger's local feed (spec "PWA & offline"):
 * matches waiting in the offline queue, rendered above the synced feed.
 * Queued variant of MatchCard: dashed gold border, no deltas yet.
 */
export function QueuedMatches() {
  const [queued, setQueued] = useState<QueuedMatchRecord[]>([]);

  const load = useCallback(() => {
    listQueuedMatches()
      .then((matches) => setQueued(matches.reverse())) // newest first, like the feed
      .catch(() => setQueued([]));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(QUEUE_CHANGED_EVENT, load);
    return () => window.removeEventListener(QUEUE_CHANGED_EVENT, load);
  }, [load]);

  if (queued.length === 0) return null;

  return (
    <div className="space-y-3">
      {queued.map((match) => (
        <div key={match.id}>
          {"incompatible" in match ? (
            <IncompatibleQueuedMatchCard match={match} />
          ) : (
            <QueuedMatchCard match={match} />
          )}
        </div>
      ))}
    </div>
  );
}

/** A durable record whose old payload shape cannot safely be reconstructed. */
export function IncompatibleQueuedMatchCard({
  match,
}: {
  match: IncompatibleQueuedMatch;
}) {
  return (
    <article className="flex flex-col gap-[11px] border border-dashed border-primary px-4 py-[15px]">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs font-semibold tracking-[1px] text-muted-foreground uppercase">
          Saved on this device
        </p>
        <Badge variant="blocked">Can&apos;t sync</Badge>
      </div>
      <h2 className="font-display text-[24px] leading-none uppercase">
        Incompatible queued match
      </h2>
      <p className="border-b border-destructive-border pb-2.5 text-[13px] leading-[1.35] font-medium tracking-[0.3px] text-destructive">
        {match.syncError}
      </p>
      <ConfirmDialog
        trigger={
          <Button
            variant="destructive"
            className="w-fit font-sans text-xs tracking-[2px]"
          >
            Discard
          </Button>
        }
        title="Discard this incompatible queued match?"
        description={`It cannot be read safely by this app version. Discarding removes ${match.ownerPlayerName}'s local record for good.`}
        confirmLabel="Discard"
        onConfirm={() => removeQueuedMatch(match.id)}
      />
    </article>
  );
}

/**
 * One queued card. Exported for the gallery (decision 127): it is already
 * prop-driven, so all three of its states — pending, transient refusal,
 * permanent refusal — are reachable from a fixture. Only the container above
 * touches IndexedDB.
 */
export function QueuedMatchCard({ match }: { match: QueuedMatch }) {
  const loserSide = match.winnerSide === "A" ? "B" : "A";
  const players = (side: "A" | "B") =>
    match.sides[side].map((participant, index) =>
      participant.kind === "player"
        ? {
            kind: "player" as const,
            playerId: participant.playerId,
            name: match.names[side][index],
          }
        : { kind: "guest" as const, name: participant.name },
    );
  const winners = players(match.winnerSide);
  const losers = players(loserSide);
  const sets = setScores(match.sets, match.winnerSide);

  // A refusal that retrying can't fix is the only one that becomes the user's
  // problem to resolve (decision 26). "Waiting for a connection" and "the
  // server is busy" resolve themselves, so they get a status line, not a
  // decision — offering Discard for those invites people to delete matches
  // that were about to sync fine.
  const stuck = isPermanentRefusal(match.syncCode);

  return (
    // The provisional variants of the feed card: same rows, same type, but a
    // dashed frame and a status badge instead of rating deltas — the server
    // hasn't scored these yet, so there are no deltas to show.
    <article
      className={`flex flex-col gap-[11px] border border-dashed px-4 py-[15px] ${
        stuck ? "border-primary" : "border-accent"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <PlayedAt at={new Date(match.playedAt)} />
        <Badge variant={stuck ? "blocked" : "pending"}>
          {stuck ? "Can't sync" : "Pending sync"}
        </Badge>
      </div>

      <MatchHeadline
        winners={<MatchPlayerNames players={winners} />}
        losers={<MatchPlayerNames players={losers} />}
      />

      {sets && <SetsRow sets={sets} />}

      {!stuck && (
        <p className="border-t pt-2.5 text-xs font-medium tracking-[0.5px] text-muted-foreground">
          {match.syncError
            ? `${match.syncError} It stays on this device and syncs by itself.`
            : "Rating pending — scored when this syncs. Only you can see it."}
        </p>
      )}

      {stuck && (
        <>
          <p className="border-b border-destructive-border pb-2.5 text-[13px] leading-[1.35] font-medium tracking-[0.3px] text-destructive">
            {match.syncError}
          </p>
          <ConfirmDialog
            trigger={
              <Button
                variant="destructive"
                className="w-fit font-sans text-xs tracking-[2px]"
              >
                Discard
              </Button>
            }
            title="Discard this queued match?"
            description={`It never reached the server and can't be sent from this device any more. Discarding removes ${match.ownerPlayerName}'s match for good — if it still matters, have them log it again from theirs.`}
            confirmLabel="Discard"
            onConfirm={() => removeQueuedMatch(match.id)}
          />
        </>
      )}
    </article>
  );
}
