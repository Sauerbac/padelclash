// Test support for the rating engine: the hand-verified golden-master fixtures
// and the seeded random-log generator + canonical serializer used by the
// property tests. Pure domain code — imported only by *.test.ts.
//
// Expected numbers in the golden masters are computed mechanically from the
// formula and stated here as independent literals (not re-derived from the
// engine), so a formula change shows up as a test diff to be reviewed.

import type {
  EngineMatch,
  EngineParticipant,
  GroupProjection,
  MatchSide,
  PlayerId,
} from "./engine";
import type { SetScore } from "../set-score";

export const player = (playerId: PlayerId): EngineParticipant => ({
  kind: "player",
  playerId,
});

export const guest = (name: string): EngineParticipant => ({
  kind: "guest",
  name,
});

/** Build a competitive simple-result singles/doubles match with sane defaults. */
export function match(input: {
  id: string;
  playedAt?: Date;
  loggedAt?: Date;
  a: PlayerId[];
  b: PlayerId[];
  winner: MatchSide;
  classification?: "competitive" | "casual";
  status?: EngineMatch["status"];
  sets?: readonly SetScore[] | null;
}): EngineMatch {
  return {
    id: input.id,
    playedAt: input.playedAt ?? at(0),
    loggedAt: input.loggedAt ?? input.playedAt ?? at(0),
    classification: input.classification ?? "competitive",
    status: input.status ?? "confirmed",
    sides: { A: input.a.map(player), B: input.b.map(player) },
    winnerSide: input.winner,
    sets: input.sets ?? null,
  };
}

function at(minute: number): Date {
  // Fixed epoch base — pure, no clock read.
  return new Date(Date.UTC(2026, 0, 1, 0, minute, 0));
}

/** Deterministic PRNG (mulberry32) so a failing property case is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a random but valid singles log: `players` distinct ids, `matches`
 * competitive simple-result matches with random winners and strictly increasing
 * timestamps. Reproducible for a given seed.
 */
export function randomSinglesLog(
  seed: number,
  players = 6,
  matches = 40,
): EngineMatch[] {
  const rng = mulberry32(seed);
  const ids = Array.from({ length: players }, (_, i) => `p${i + 1}`);
  const pick = () => ids[Math.floor(rng() * ids.length)];

  const log: EngineMatch[] = [];
  for (let i = 0; i < matches; i++) {
    const a = pick();
    let b = pick();
    while (b === a) b = pick();
    log.push(
      match({
        id: `m${String(i + 1).padStart(4, "0")}`,
        playedAt: at(i),
        a: [a],
        b: [b],
        winner: rng() < 0.5 ? "A" : "B",
      }),
    );
  }
  return log;
}

/** Fisher–Yates shuffle driven by the seeded PRNG (pure, no clock/global RNG). */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Canonical, order-stable string form of a projection — for byte-identical
 * comparison regardless of input order. Sorts both tables by their keys and
 * renders Dates as ISO strings.
 */
export function serializeProjection(p: GroupProjection): string {
  const current = [...p.currentRating.values()]
    .sort((x, y) => (x.playerId < y.playerId ? -1 : 1))
    .map((r) => ({
      ...r,
      lastMatchAt: r.lastMatchAt?.toISOString() ?? null,
    }));
  const history = p.ratingHistory
    .slice()
    .sort((x, y) =>
      x.matchId !== y.matchId
        ? x.matchId < y.matchId
          ? -1
          : 1
        : x.playerId < y.playerId
          ? -1
          : 1,
    )
    .map((h) => ({ ...h, playedAt: h.playedAt.toISOString() }));
  return JSON.stringify({ current, history });
}
