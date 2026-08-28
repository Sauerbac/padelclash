import { LeaderboardView } from "@/components/leaderboard-view";
import type { PullIndicatorPhase } from "@/components/pull-to-refresh";
import { TabShell } from "@/components/tab-shell";
import type { LeaderboardEntry } from "@/services/matches";
import type { ScreenCase } from "../screen-cases";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { NoSavedView } from "@/components/saved-view-fallback";
import { CASEY, INGRID, LONG, YOU } from "./shared";

const FULL: LeaderboardEntry[] = [
  {
    playerId: LONG.id,
    name: LONG.name,
    rating: 1487,
    rank: 1,
    wins: 12,
    losses: 3,
    matchesPlayed: 15,
  },
  {
    playerId: YOU.id,
    name: YOU.name,
    rating: 1315,
    rank: 2,
    wins: 9,
    losses: 7,
    matchesPlayed: 16,
  },
  {
    playerId: CASEY.id,
    name: CASEY.name,
    rating: 1120,
    rank: 3,
    wins: 5,
    losses: 4,
    matchesPlayed: 9,
  },
  {
    playerId: INGRID.id,
    name: INGRID.name,
    rating: 1000,
    rank: null,
    wins: 1,
    losses: 1,
    matchesPlayed: 2,
  },
];

const TIED_RATINGS: LeaderboardEntry[] = FULL.slice(0, 3).map((entry, index) => ({
  ...entry,
  rating: 1200,
  rank: index + 1,
  wins: index === 0 ? 12 : 9,
  matchesPlayed: index === 0 ? 15 : index === 1 ? 16 : 9,
}));

function refreshPreview(phase: PullIndicatorPhase) {
  return (
    <TabShell pathname="/leaderboard">
      <LeaderboardView
        entries={FULL}
        youId={YOU.id}
        isAdmin={false}
        pullToRefreshPhase={phase}
      />
    </TabShell>
  );
}

const PULL_CASES: Record<PullIndicatorPhase, ScreenCase> = {
  pulling: {
    title: "Pull to refresh",
    note: "Rankings is moving with a downward drag. The indicator stays hidden at first, then the centered label fades in subtly between two fixed arrows.",
    render: () => refreshPreview("pulling"),
  },
  ready: {
    title: "Release to refresh",
    note: "Rankings crossed the threshold. The copy cross-fades while both fixed arrows rotate over the same interval; releasing now reloads the projection.",
    render: () => refreshPreview("ready"),
  },
  refreshing: {
    title: "Refreshing",
    note: "The paired arrows have cross-faded to one centered spinner-and-label group. Standings hold their loading offset until the new projection arrives, then ease back to normal.",
    render: () => refreshPreview("refreshing"),
  },
  "poor-connection": {
    title: "Refresh on a poor connection",
    note: "The existing Rankings remain visible while the five-second status reports a poor connection.",
    render: () => refreshPreview("poor-connection"),
  },
};

export const LEADERBOARD_CASES: Record<string, ScreenCase> = {
  ...PULL_CASES,

  skeleton: {
    title: "Rankings destination skeleton",
    note: "The stable table-shaped loading surface appears as soon as Rankings is selected.",
    render: () => <TabShell pathname="/leaderboard"><ScreenSkeleton kind="leaderboard" /></TabShell>,
  },
  "saved-view": {
    title: "Timestamped read-only Saved View",
    note: "A poor connection reveals the last Rankings projection without enabling uncached Player Detail navigation.",
    render: () => <TabShell pathname="/leaderboard"><LeaderboardView entries={FULL} youId={YOU.id} isAdmin={false} savedAt={new Date("2026-08-27T19:15:00Z")} /></TabShell>,
  },
  "no-saved-data": {
    title: "Poor connection without Saved View",
    note: "No stale data is invented; the state offers an explicit retry.",
    render: () => <TabShell pathname="/leaderboard"><NoSavedView reloadOnRetry={false} /></TabShell>,
  },
  recovery: {
    title: "Recovered fresh Rankings",
    note: "The live projection replaces the Saved View and restores ordinary Player links.",
    render: () => <TabShell pathname="/leaderboard"><LeaderboardView entries={FULL} youId={YOU.id} isAdmin={false} /></TabShell>,
  },

  mixed: {
    title: "Podium plus ranked and provisional rows",
    note: "Top three move onto the stand; the table starts after them and explains the threshold.",
    render: () => (
      <TabShell pathname="/leaderboard">
        <LeaderboardView entries={FULL} youId={YOU.id} isAdmin />
      </TabShell>
    ),
  },
  early: {
    title: "Fewer than three ranked Players",
    note: "The plain table carries everyone; a partial podium is deliberately omitted.",
    render: () => (
      <TabShell pathname="/leaderboard">
        <LeaderboardView
          entries={FULL.slice(0, 2).map((entry, index) => ({
            ...entry,
            rank: index === 0 ? 1 : null,
          }))}
          youId={null}
          isAdmin={false}
        />
      </TabShell>
    ),
  },
  "exactly-three": {
    title: "Exactly three ranked Players",
    note: "The podium is the whole result; no empty table header renders below it.",
    render: () => (
      <TabShell pathname="/leaderboard">
        <LeaderboardView
          entries={FULL.slice(0, 3)}
          youId={YOU.id}
          isAdmin={false}
        />
      </TabShell>
    ),
  },
  "tied-ratings": {
    title: "Podium with tied Ratings",
    note: "Equal Ratings still produce unique podium positions: wins lead first, then total competitive Matches.",
    render: () => (
      <TabShell pathname="/leaderboard">
        <LeaderboardView
          entries={TIED_RATINGS}
          youId={YOU.id}
          isAdmin={false}
        />
      </TabShell>
    ),
  },
  empty: {
    title: "No active Players",
    note: "Only the documented empty copy and shared tab bar remain.",
    render: () => (
      <TabShell pathname="/leaderboard">
        <LeaderboardView entries={[]} youId={null} isAdmin={false} />
      </TabShell>
    ),
  },
};
