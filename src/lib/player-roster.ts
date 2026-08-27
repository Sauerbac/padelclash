export interface NamedPlayer {
  name: string;
}

export interface IdentifiedPlayer {
  id: string;
}

export interface PlayerMatchRecord {
  playerId: string;
  wins: number;
  losses: number;
}

export type SharedMatchCounts = Record<string, number>;

const playerNameCollator = new Intl.Collator(undefined, {
  sensitivity: "base",
});

/** Return a name-sorted copy so callers never mutate their source roster. */
export function sortPlayersByName<T extends NamedPlayer>(players: T[]): T[] {
  return [...players].sort((a, b) => playerNameCollator.compare(a.name, b.name));
}

/**
 * Count every Match shared with a Player, whether as partners or opponents.
 * A Player may occur in both relationship lists, so the groups are summed.
 */
export function countSharedMatches(
  ...recordGroups: PlayerMatchRecord[][]
): SharedMatchCounts {
  const counts: SharedMatchCounts = {};
  for (const record of recordGroups.flat()) {
    counts[record.playerId] =
      (counts[record.playerId] ?? 0) + record.wins + record.losses;
  }
  return counts;
}

/** Most frequently shared Matches first; Player Name breaks equal counts. */
export function sortPlayersBySharedMatches<
  T extends NamedPlayer & IdentifiedPlayer,
>(players: T[], counts: SharedMatchCounts): T[] {
  return [...players].sort((a, b) => {
    const frequencyDifference = (counts[b.id] ?? 0) - (counts[a.id] ?? 0);
    return frequencyDifference || playerNameCollator.compare(a.name, b.name);
  });
}

/**
 * Advance page-load counts after a Match reaches the authoritative log.
 * Only roster co-participants of the bound Player gain one shared Match.
 */
export function addSharedMatchToCounts(
  counts: SharedMatchCounts,
  boundPlayerId: string,
  participantPlayerIds: string[],
): SharedMatchCounts {
  const participants = new Set(participantPlayerIds);
  if (!participants.has(boundPlayerId)) return counts;

  const nextCounts = { ...counts };
  for (const playerId of participants) {
    if (playerId === boundPlayerId) continue;
    nextCounts[playerId] = (nextCounts[playerId] ?? 0) + 1;
  }
  return nextCounts;
}

/** Filter by a trimmed, case-insensitive substring of the display name. */
export function filterPlayersByName<T extends NamedPlayer>(
  players: T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return players;
  return players.filter((player) =>
    player.name.toLocaleLowerCase().includes(normalizedQuery),
  );
}

/** Remove selections from a picker while preserving the existing order. */
export function removeSelectedPlayers<T extends IdentifiedPlayer>(
  players: T[],
  selectedPlayerIds: Set<string>,
  selectedPlayerId?: string,
): T[] {
  return players.filter(
    (player) =>
      player.id === selectedPlayerId || !selectedPlayerIds.has(player.id),
  );
}

/** Remove every listed Player while preserving the remaining roster order. */
export function removePlayersById<T extends IdentifiedPlayer>(
  players: T[],
  playerIds: Set<string>,
): T[] {
  return players.filter((player) => !playerIds.has(player.id));
}

export function toggleExpandedPlayer(
  expandedPlayerId: string | null,
  playerId: string,
): string | null {
  return expandedPlayerId === playerId ? null : playerId;
}

export function retainExpandedPlayer(
  expandedPlayerId: string | null,
  visiblePlayerIds: string[],
): string | null {
  return expandedPlayerId && visiblePlayerIds.includes(expandedPlayerId)
    ? expandedPlayerId
    : null;
}
