import { PlayerDetailView } from "@/components/player-detail-view";
import { ConnectionRequiredLoading } from "@/components/connection-required-loading";
import { TabShell } from "@/components/tab-shell";
import type { PlayerDetail } from "@/services/matches";
import type { ScreenCase } from "../screen-cases";
import {
  CASEY,
  FEED,
  INGRID,
  inert,
  LONG,
  NOW,
  YOU,
} from "./shared";

const FULL: PlayerDetail = {
  playerId: YOU.id,
  name: YOU.name,
  retired: false,
  rating: 1315,
  rank: 2,
  wins: 9,
  losses: 7,
  ratingSeries: [
    {
      matchId: FEED[3].id,
      playedAt: FEED[3].playedAt,
      delta: 5,
      ratingAfter: 1005,
    },
    {
      matchId: FEED[2].id,
      playedAt: FEED[2].playedAt,
      delta: -8,
      ratingAfter: 997,
    },
    {
      matchId: FEED[0].id,
      playedAt: FEED[0].playedAt,
      delta: 187,
      ratingAfter: 1184,
    },
  ],
  matches: FEED,
  headToHead: [
    { playerId: LONG.id, name: LONG.name, wins: 4, losses: 3 },
    { playerId: CASEY.id, name: CASEY.name, wins: 2, losses: 2 },
  ],
  partners: [{ playerId: CASEY.id, name: CASEY.name, wins: 3, losses: 1 }],
};

export const PLAYER_CASES: Record<string, ScreenCase> = {
  loading: {
    title: "Player Detail contacting server",
    note: "This connection-required route never masquerades as a Feed Saved View while loading.",
    render: () => <TabShell pathname={`/players/${YOU.id}`}><ConnectionRequiredLoading title="Player Detail" /></TabShell>,
  },
  active: {
    title: "Active Player with complete history",
    note: "You badge, summary, chart, relationships and reusable Match cards.",
    render: () => (
      <TabShell pathname={`/players/${YOU.id}`}>
        {inert(
          <PlayerDetailView
            detail={FULL}
            viewer={{ playerId: YOU.id, isAdmin: false }}
            now={NOW}
          />,
        )}
      </TabShell>
    ),
  },
  retired: {
    title: "Retired historical Player",
    note: "The page stays available, carries Retired, and is never ranked.",
    render: () => (
      <TabShell pathname={`/players/${INGRID.id}`}>
        {inert(
          <PlayerDetailView
            detail={{
              ...FULL,
              playerId: INGRID.id,
              name: INGRID.name,
              retired: true,
              rank: null,
            }}
            viewer={{ playerId: YOU.id, isAdmin: false }}
            now={NOW}
          />,
        )}
      </TabShell>
    ),
  },
  empty: {
    title: "Player without Matches",
    note: "No chart or relationship sections; Match history shows its empty copy.",
    render: () => (
      <TabShell pathname={`/players/${CASEY.id}`}>
        <PlayerDetailView
          detail={{
            playerId: CASEY.id,
            name: CASEY.name,
            retired: false,
            rating: 1000,
            rank: null,
            wins: 0,
            losses: 0,
            ratingSeries: [],
            matches: [],
            headToHead: [],
            partners: [],
          }}
          viewer={{ playerId: YOU.id, isAdmin: false }}
          now={NOW}
        />
      </TabShell>
    ),
  },
};
