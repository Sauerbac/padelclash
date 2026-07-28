import { describe, expect, it } from "vitest";
import {
  createMatchLogProjection,
  type MatchLogSnapshot,
} from "./match-log-projection";

const ids = {
  alex: "00000000-0000-4000-8000-000000000001",
  blair: "00000000-0000-4000-8000-000000000002",
  casey: "00000000-0000-4000-8000-000000000003",
  dana: "00000000-0000-4000-8000-000000000004",
};
const days = [
  new Date("2026-07-01T18:00:00Z"),
  new Date("2026-07-02T18:00:00Z"),
  new Date("2026-07-03T18:00:00Z"),
];
const matchIds = [
  "01900000-0000-7000-8000-000000000001",
  "01900000-0000-7000-8000-000000000002",
  "01900000-0000-7000-8000-000000000003",
];

const snapshot: MatchLogSnapshot = {
  players: [
    player(ids.alex, "Alex", 0),
    player(ids.blair, "Blair", 1),
    player(ids.casey, "Casey", 2, days[2]),
    player(ids.dana, "Dana", 3),
  ],
  matches: [
    match(matchIds[0], days[0], ids.alex, "A"),
    match(matchIds[1], days[1], ids.casey, "A"),
    match(matchIds[2], days[2], ids.blair, "A"),
  ],
  participants: [
    participant(matchIds[0], ids.alex, null, "A", 0),
    participant(matchIds[0], ids.blair, null, "B", 0),
    participant(matchIds[1], ids.alex, null, "A", 0),
    participant(matchIds[1], ids.casey, null, "A", 1),
    participant(matchIds[1], ids.blair, null, "B", 0),
    participant(matchIds[1], null, "Visiting Pat", "B", 1),
    participant(matchIds[2], ids.blair, null, "A", 0),
    participant(matchIds[2], ids.alex, null, "B", 0),
  ],
  ratingHistory: [
    history(matchIds[0], ids.alex, "A", 1000, 40, 1040, days[0]),
    history(matchIds[0], ids.blair, "B", 1000, -40, 960, days[0]),
    history(matchIds[1], ids.alex, "A", 1040, 30, 1070, days[1]),
    history(matchIds[1], ids.casey, "A", 1000, 40, 1040, days[1]),
    history(matchIds[1], ids.blair, "B", 960, -35, 925, days[1]),
    history(matchIds[2], ids.blair, "A", 925, 25, 950, days[2]),
    history(matchIds[2], ids.alex, "B", 1070, -20, 1050, days[2]),
  ],
  currentRatings: [
    current(ids.alex, 1050, 3, true),
    current(ids.blair, 950, 3, true),
    current(ids.casey, 1040, 1, false),
  ],
};

describe("Match-log read projection", () => {
  const projection = createMatchLogProjection(snapshot);

  it("selects Feed, Leaderboard, and Player Detail from one snapshot", () => {
    expect(projection.feed().map(({ id }) => id)).toEqual([
      matchIds[2],
      matchIds[1],
      matchIds[0],
    ]);
    expect(
      projection
        .feed()[1]
        .participants.map((participant) => [participant.kind, participant.name]),
    ).toEqual([
      ["player", "Alex"],
      ["player", "Casey"],
      ["player", "Blair"],
      ["guest", "Visiting Pat"],
    ]);

    expect(
      projection
        .leaderboard()
        .map(({ name, rank, wins, losses }) => [name, rank, wins, losses]),
    ).toEqual([
      ["Alex", 1, 2, 1],
      ["Blair", 2, 1, 2],
      ["Dana", null, 0, 0],
    ]);

    expect(projection.playerDetail(ids.alex)).toMatchObject({
      name: "Alex",
      rank: 1,
      wins: 2,
      losses: 1,
      ratingSeries: [
        { matchId: matchIds[0], ratingAfter: 1040 },
        { matchId: matchIds[1], ratingAfter: 1070 },
        { matchId: matchIds[2], ratingAfter: 1050 },
      ],
      headToHead: [{ name: "Blair", wins: 2, losses: 1 }],
      partners: [{ name: "Casey", wins: 1, losses: 0 }],
    });
  });

  it("keeps retirees addressable and fresh Players unranked", () => {
    expect(projection.playerDetail(ids.casey)).toMatchObject({
      retired: true,
      rank: null,
      wins: 1,
    });
    expect(projection.playerDetail(ids.dana)).toMatchObject({
      rating: 1000,
      rank: null,
      wins: 0,
      losses: 0,
      matches: [],
    });
  });
});

function player(id: string, name: string, order: number, retiredAt: Date | null = null) {
  return { id, name, retiredAt, createdAt: new Date(2026, 0, order + 1) };
}

function match(
  id: string,
  playedAt: Date,
  loggedBy: string,
  winnerSide: "A" | "B",
) {
  return { id, playedAt, loggedAt: playedAt, loggedBy, winnerSide, sets: null };
}

function participant(
  matchId: string,
  playerId: string | null,
  guestName: string | null,
  side: "A" | "B",
  slot: number,
) {
  return { matchId, playerId, guestName, side, slot };
}

function history(
  matchId: string,
  playerId: string,
  side: "A" | "B",
  ratingBefore: number,
  delta: number,
  ratingAfter: number,
  playedAt: Date,
) {
  return {
    matchId,
    playerId,
    side,
    ratingBefore,
    delta,
    ratingAfter,
    playedAt,
  };
}

function current(
  playerId: string,
  rating: number,
  competitiveMatchesPlayed: number,
  isRanked: boolean,
) {
  return {
    playerId,
    rating,
    competitiveMatchesPlayed,
    isRanked,
  };
}
