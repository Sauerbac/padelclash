import { LeaderboardView } from "@/components/leaderboard-view";
import { TabShell } from "@/components/tab-shell";
import type { LeaderboardEntry } from "@/services/matches";
import type { ScreenCase } from "../screen-cases";
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

export const LEADERBOARD_CASES: Record<string, ScreenCase> = {
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
