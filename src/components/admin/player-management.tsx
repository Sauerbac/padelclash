"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  createPlayerAction,
  type CreatePlayerState,
} from "@/app/actions/admin";
import { AdminRoster } from "@/components/admin/admin-roster";
import {
  PlayerRow,
  type PlayerRowActions,
} from "@/components/admin/player-row";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { removePlayersById } from "@/lib/player-roster";
import type {
  AdminRoster as AdminRosterData,
  RosterEntry,
} from "@/services/players";

export type CreatePlayer = typeof createPlayerAction;

export function PlayerManagement({
  roster,
  createPlayer = createPlayerAction,
  actions,
  initialSearch,
  initialExpandedPlayerId,
}: {
  roster: AdminRosterData;
  createPlayer?: CreatePlayer;
  actions?: PlayerRowActions;
  initialSearch?: string;
  initialExpandedPlayerId?: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    CreatePlayerState,
    FormData
  >(
    createPlayer,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [dismissedPlayerIds, setDismissedPlayerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const createdPlayerIds = useMemo(
    () =>
      (state.createdPlayers ?? [])
        .map(({ id }) => id)
        .filter((id) => !dismissedPlayerIds.has(id)),
    [dismissedPlayerIds, state.createdPlayers],
  );
  const createdEntries = useMemo(
    () => findRosterEntries(roster, createdPlayerIds),
    [createdPlayerIds, roster],
  );
  const visibleRoster = useMemo(
    () => omitRosterEntries(roster, new Set(createdPlayerIds)),
    [createdPlayerIds, roster],
  );

  // Clear the input after a successful create, not after a later failed attempt.
  useEffect(() => {
    if (state.createdPlayers && !state.error) formRef.current?.reset();
  }, [state.createdPlayers, state.error]);

  return (
    <>
      <section>
        <h2 className="section-label text-primary">Add a player</h2>
        <p className="mt-1 mb-2.5 text-sm font-semibold text-muted-foreground">
          New players start not joined, with no invite until you make one.
        </p>
        <form
          ref={formRef}
          action={formAction}
          data-create-player
          className="space-y-2"
        >
          <div className="flex gap-2">
            <Input name="name" placeholder="New player name" required />
            <Button type="submit" disabled={pending} className="px-5 text-base">
              Add
            </Button>
          </div>
          {state.error && <Alert variant="destructive">{state.error}</Alert>}
        </form>

        {createdEntries.length > 0 && (
          <div className="mt-3" data-new-player>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">
              {createdEntries.length === 1 ? "Player" : "Players"} added.
              Generate an invite now, or manage them below.
            </p>
            <ul className="space-y-2">
              {createdEntries.map((entry) => (
                <PlayerRow
                  key={entry.id}
                  entry={entry}
                  collapsible={false}
                  onDeleted={(playerId) =>
                    setDismissedPlayerIds((current) => {
                      const next = new Set(current);
                      next.add(playerId);
                      return next;
                    })
                  }
                  actions={actions}
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      <AdminRoster
        roster={visibleRoster}
        actions={actions}
        initialSearch={initialSearch}
        initialExpandedPlayerId={initialExpandedPlayerId}
      />
    </>
  );
}

function findRosterEntries(
  roster: AdminRosterData,
  playerIds: string[],
): RosterEntry[] {
  const entryById = new Map(
    [...roster.joined, ...roster.notJoined, ...roster.retired].map((entry) => [
      entry.id,
      entry,
    ]),
  );
  return playerIds.flatMap((id) => {
    const entry = entryById.get(id);
    return entry ? [entry] : [];
  });
}

function omitRosterEntries(
  roster: AdminRosterData,
  playerIds: Set<string>,
): AdminRosterData {
  if (playerIds.size === 0) return roster;
  return {
    joined: removePlayersById(roster.joined, playerIds),
    notJoined: removePlayersById(roster.notJoined, playerIds),
    retired: removePlayersById(roster.retired, playerIds),
  };
}
