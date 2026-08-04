"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  filterPlayersByName,
  retainExpandedPlayer,
  sortPlayersByName,
  toggleExpandedPlayer,
} from "@/lib/player-roster";
import {
  PlayerRow,
  type PlayerRowActions,
} from "@/components/admin/player-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminRoster as AdminRosterData, RosterEntry } from "@/services/players";

interface RosterGroup {
  title: string;
  blurb: string;
  empty: string;
  entries: RosterEntry[];
}

interface VisibleRosterGroup extends RosterGroup {
  visibleEntries: RosterEntry[];
}

function visibleRosterGroups(
  groups: RosterGroup[],
  query: string,
): VisibleRosterGroup[] {
  return groups.map((group) => ({
    ...group,
    visibleEntries: filterPlayersByName(group.entries, query),
  }));
}

function getVisiblePlayerIds(groups: VisibleRosterGroup[]): string[] {
  return groups.flatMap((group) => group.visibleEntries.map(({ id }) => id));
}

export function AdminRoster({
  roster,
  actions,
  initialSearch = "",
  initialExpandedPlayerId = null,
}: {
  roster: AdminRosterData;
  actions?: PlayerRowActions;
  initialSearch?: string;
  initialExpandedPlayerId?: string | null;
}) {
  const searchId = useId();
  const focusAfterDeleteRef = useRef<string | "search" | null>(null);
  const [query, setQuery] = useState(initialSearch);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(
    initialExpandedPlayerId,
  );
  const groups = useMemo<RosterGroup[]>(
    () => [
      {
        title: "Joined",
        blurb: "Holding an active device binding.",
        empty: "Nobody has joined yet.",
        entries: sortPlayersByName(roster.joined),
      },
      {
        title: "Not joined",
        blurb: "On the roster, waiting for an invite.",
        empty: "Everyone on the roster has joined.",
        entries: sortPlayersByName(roster.notJoined),
      },
      {
        title: "Retired",
        blurb: "Out of the pickers; history and name preserved.",
        empty: "No retired players.",
        entries: sortPlayersByName(roster.retired),
      },
    ],
    [roster],
  );
  const activeQuery = query.trim();
  const visibleGroups = useMemo<VisibleRosterGroup[]>(
    () => visibleRosterGroups(groups, activeQuery),
    [activeQuery, groups],
  );
  const visiblePlayerIds = useMemo(
    () => getVisiblePlayerIds(visibleGroups),
    [visibleGroups],
  );
  const visibleCount = visiblePlayerIds.length;
  const totalCount = groups.reduce((count, group) => count + group.entries.length, 0);

  useEffect(() => {
    const nextExpandedPlayerId = retainExpandedPlayer(
      expandedPlayerId,
      visiblePlayerIds,
    );
    if (nextExpandedPlayerId === expandedPlayerId) return;
    const timer = window.setTimeout(
      () => setExpandedPlayerId(nextExpandedPlayerId),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [expandedPlayerId, visiblePlayerIds]);

  useEffect(() => {
    const target = focusAfterDeleteRef.current;
    if (!target) return;
    const timer = window.setTimeout(() => {
      const element =
        target === "search"
          ? document.getElementById(searchId)
          : document.querySelector<HTMLElement>(
              `[aria-controls="player-panel-${target}"]`,
            );
      element?.focus();
      focusAfterDeleteRef.current = null;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [expandedPlayerId, searchId, visiblePlayerIds]);

  function changeSearch(nextQuery: string) {
    setQuery(nextQuery);
    const nextVisiblePlayerIds = getVisiblePlayerIds(
      visibleRosterGroups(groups, nextQuery),
    );
    setExpandedPlayerId((current) =>
      retainExpandedPlayer(current, nextVisiblePlayerIds),
    );
  }

  function handleDeleted(playerId: string) {
    const deletedIndex = visiblePlayerIds.indexOf(playerId);
    const nextPlayerId =
      visiblePlayerIds[deletedIndex + 1] ?? visiblePlayerIds[deletedIndex - 1];
    focusAfterDeleteRef.current = nextPlayerId ?? "search";
    setExpandedPlayerId(null);
  }

  const visibleExpandedPlayerId = retainExpandedPlayer(
    expandedPlayerId,
    visiblePlayerIds,
  );

  return (
    <div data-admin-roster className="space-y-5">
      <section aria-labelledby={`${searchId}-label`}>
        <label id={`${searchId}-label`} htmlFor={searchId} className="section-label">
          Search players
        </label>
        <div className="relative mt-2">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => changeSearch(event.target.value)}
            placeholder="Search players…"
            autoComplete="off"
            className="h-11 pr-10 pl-10"
          />
          {query.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Clear player search"
              onClick={() => changeSearch("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <XIcon aria-hidden className="size-4" />
            </Button>
          )}
        </div>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {activeQuery
            ? visibleCount === 0
              ? "No players found"
              : `${visibleCount} ${visibleCount === 1 ? "player" : "players"} found`
            : `${totalCount} ${totalCount === 1 ? "player" : "players"}`}
        </p>
      </section>

      {activeQuery && visibleCount === 0 ? (
        <p className="text-sm font-semibold text-muted-foreground">No players found</p>
      ) : (
        visibleGroups.map((group) => {
          if (activeQuery && group.visibleEntries.length === 0) return null;
          return (
            <RosterGroup
              key={group.title}
              title={group.title}
              blurb={group.blurb}
              empty={group.empty}
              total={group.entries.length}
              entries={group.visibleEntries}
              filtered={Boolean(activeQuery)}
              expandedPlayerId={visibleExpandedPlayerId}
              onToggle={(playerId) =>
                setExpandedPlayerId((current) =>
                  toggleExpandedPlayer(current, playerId),
                )
              }
              onDeleted={handleDeleted}
              actions={actions}
            />
          );
        })
      )}
    </div>
  );
}

function RosterGroup({
  title,
  blurb,
  empty,
  total,
  entries,
  filtered,
  expandedPlayerId,
  onToggle,
  onDeleted,
  actions,
}: {
  title: string;
  blurb: string;
  empty: string;
  total: number;
  entries: RosterEntry[];
  filtered: boolean;
  expandedPlayerId: string | null;
  onToggle: (playerId: string) => void;
  onDeleted: (playerId: string) => void;
  actions?: PlayerRowActions;
}) {
  return (
    <section aria-labelledby={`${title.toLocaleLowerCase().replaceAll(" ", "-")}-heading`}>
      <h2
        id={`${title.toLocaleLowerCase().replaceAll(" ", "-")}-heading`}
        className="section-label text-primary"
      >
        {title} · {filtered ? `${entries.length} of ${total}` : total}
      </h2>
      <p className="mt-1 mb-2.5 text-sm font-semibold text-muted-foreground">
        {blurb}
      </p>
      {entries.length === 0 ? (
        <p className="text-sm font-semibold text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <PlayerRow
              key={entry.id}
              entry={entry}
              expanded={expandedPlayerId === entry.id}
              onToggle={() => onToggle(entry.id)}
              onDeleted={onDeleted}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
