export interface NamedPlayer {
  name: string;
}

export interface IdentifiedPlayer {
  id: string;
}

const playerNameCollator = new Intl.Collator(undefined, {
  sensitivity: "base",
});

/** Return a name-sorted copy so callers never mutate their source roster. */
export function sortPlayersByName<T extends NamedPlayer>(players: T[]): T[] {
  return [...players].sort((a, b) => playerNameCollator.compare(a.name, b.name));
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
