// Framework-free Rating replay. Persistence belongs in services/.

import type {
  GuestParticipant,
  MatchParticipant as EngineParticipant,
  PlayerParticipant,
} from "../match-participant";

export type { EngineParticipant, GuestParticipant, PlayerParticipant };

export type PlayerId = string;
export type MatchSide = "A" | "B";

export const STARTING_RATING = 1000;
export const ESTABLISHED_K = 50;
export const PROVISIONAL_K = 70;
export const RATING_DIVISOR = 400;
export const DEFAULT_RANKED_THRESHOLD = 3;
export const MIN_CHANGE = 1;
export const MAX_CHANGE = 50;

export interface EngineSetScore {
  a: number;
  b: number;
}

export interface EngineMatch {
  id: string;
  playedAt: Date;
  loggedAt: Date;
  classification: "competitive" | "casual";
  status: "pending" | "confirmed" | "contested" | "voided";
  sides: Record<MatchSide, readonly EngineParticipant[]>;
  winnerSide: MatchSide;
  sets: readonly EngineSetScore[] | null;
}

export interface PlayerState {
  rating: number;
  competitiveMatchesPlayed: number;
  matchesSinceReset: number;
}

export interface ParticipantOutput {
  matchId: string;
  playerId: PlayerId;
  side: MatchSide;
  ratingBefore: number;
  delta: number;
  ratingAfter: number;
  wasProvisional: boolean;
  expectedScore: number;
  playedAt: Date;
}

export interface CurrentRating {
  playerId: PlayerId;
  rating: number;
  competitiveMatchesPlayed: number;
  matchesSinceReset: number;
  isProvisional: boolean;
  isRanked: boolean;
  lastMatchAt: Date | null;
}

export interface GroupProjection {
  currentRating: Map<PlayerId, CurrentRating>;
  ratingHistory: ParticipantOutput[];
}

export function expectedScore(ratingFor: number, ratingAgainst: number): number {
  return 1 / (1 + 10 ** ((ratingAgainst - ratingFor) / RATING_DIVISOR));
}

export function kFactor(state: PlayerState): number {
  return state.competitiveMatchesPlayed < DEFAULT_RANKED_THRESHOLD
    ? PROVISIONAL_K
    : ESTABLISHED_K;
}

function stateOf(
  byPlayer: ReadonlyMap<PlayerId, PlayerState>,
  id: PlayerId,
): PlayerState {
  return (
    byPlayer.get(id) ?? {
      rating: STARTING_RATING,
      competitiveMatchesPlayed: 0,
      matchesSinceReset: 0,
    }
  );
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreMultiplier(
  sets: readonly EngineSetScore[] | null,
  winnerSide: MatchSide,
): number {
  if (sets === null) return 1;
  let winnerGames = 0;
  let loserGames = 0;
  for (const set of sets) {
    winnerGames += winnerSide === "A" ? set.a : set.b;
    loserGames += winnerSide === "A" ? set.b : set.a;
  }
  const totalGames = winnerGames + loserGames;
  const dominance =
    totalGames === 0 ? 0 : Math.max(0, winnerGames - loserGames) / totalGames;
  return 1 + 0.4 * dominance;
}

/**
 * Pure step from one immutable pre-Match snapshot to the next. Guests receive
 * an input Rating but never an output or threaded state.
 */
export function replayMatch(
  prior: ReadonlyMap<PlayerId, PlayerState>,
  match: EngineMatch,
): { next: Map<PlayerId, PlayerState>; outputs: ParticipantOutput[] } {
  const players = [...match.sides.A, ...match.sides.B].filter(
    (participant): participant is PlayerParticipant =>
      participant.kind === "player",
  );
  const guestRating = mean(
    players.map((participant) => stateOf(prior, participant.playerId).rating),
  );
  const participantRating = (participant: EngineParticipant): number =>
    participant.kind === "player"
      ? stateOf(prior, participant.playerId).rating
      : guestRating;
  const opposingMean: Record<MatchSide, number> = {
    A: mean(match.sides.B.map(participantRating)),
    B: mean(match.sides.A.map(participantRating)),
  };
  const multiplier = scoreMultiplier(match.sets, match.winnerSide);
  const next = new Map(prior);
  const outputs: ParticipantOutput[] = [];

  for (const side of ["A", "B"] as const) {
    for (const participant of match.sides[side]) {
      if (participant.kind === "guest") continue;
      const before = stateOf(prior, participant.playerId);
      const expected = expectedScore(before.rating, opposingMean[side]);
      const won = match.winnerSide === side;
      const base = kFactor(before) * (won ? 1 - expected : expected);
      const magnitude = Math.max(
        MIN_CHANGE,
        Math.min(MAX_CHANGE, Math.round(base * multiplier)),
      );
      const delta = won ? magnitude : -magnitude;
      const ratingAfter = before.rating + delta;

      next.set(participant.playerId, {
        rating: ratingAfter,
        competitiveMatchesPlayed: before.competitiveMatchesPlayed + 1,
        matchesSinceReset: before.matchesSinceReset + 1,
      });
      outputs.push({
        matchId: match.id,
        playerId: participant.playerId,
        side,
        ratingBefore: before.rating,
        delta,
        ratingAfter,
        wasProvisional:
          before.competitiveMatchesPlayed < DEFAULT_RANKED_THRESHOLD,
        expectedScore: expected,
        playedAt: match.playedAt,
      });
    }
  }

  return { next, outputs };
}

export function compareMatches(a: EngineMatch, b: EngineMatch): number {
  return (
    a.playedAt.getTime() - b.playedAt.getTime() ||
    a.loggedAt.getTime() - b.loggedAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

export function projectGroup(
  matches: readonly EngineMatch[],
  opts: { rankedThreshold?: number } = {},
): GroupProjection {
  const rankedThreshold = opts.rankedThreshold ?? DEFAULT_RANKED_THRESHOLD;
  const stream = matches
    .filter((match) => match.classification === "competitive" && match.status !== "voided")
    .sort(compareMatches);

  let state: ReadonlyMap<PlayerId, PlayerState> = new Map();
  const ratingHistory: ParticipantOutput[] = [];
  const lastMatchAt = new Map<PlayerId, Date>();

  for (const match of stream) {
    const { next, outputs } = replayMatch(state, match);
    state = next;
    for (const output of outputs) {
      ratingHistory.push(output);
      lastMatchAt.set(output.playerId, match.playedAt);
    }
  }

  const currentRating = new Map<PlayerId, CurrentRating>();
  for (const [playerId, player] of state) {
    currentRating.set(playerId, {
      playerId,
      rating: player.rating,
      competitiveMatchesPlayed: player.competitiveMatchesPlayed,
      matchesSinceReset: player.matchesSinceReset,
      isProvisional:
        player.competitiveMatchesPlayed < DEFAULT_RANKED_THRESHOLD,
      isRanked: player.competitiveMatchesPlayed >= rankedThreshold,
      lastMatchAt: lastMatchAt.get(playerId) ?? null,
    });
  }

  return { currentRating, ratingHistory };
}

export function rankMap(
  current: ReadonlyMap<PlayerId, CurrentRating>,
): Map<PlayerId, number> {
  const ranked = [...current.values()]
    .filter((entry) => entry.isRanked)
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0),
    );
  return new Map(ranked.map((entry, index) => [entry.playerId, index + 1]));
}
