export function reconcileDraftRoster<T extends { id: string; name: string }>(
  freshRoster: T[],
  selectedPlayerIds: string[],
  savedNames: Record<string, string>,
): {
  entries: { id: string; name: string }[];
  invalidSelectedIds: string[];
} {
  const entries = new Map<string, { id: string; name: string }>(
    freshRoster.map((player) => [player.id, player]),
  );
  const invalidSelectedIds: string[] = [];
  for (const id of selectedPlayerIds) {
    if (entries.has(id)) continue;
    invalidSelectedIds.push(id);
    if (savedNames[id]) entries.set(id, { id, name: savedNames[id] });
  }
  return { entries: [...entries.values()], invalidSelectedIds };
}
