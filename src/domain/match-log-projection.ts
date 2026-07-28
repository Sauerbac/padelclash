import { STARTING_RATING, type MatchSide } from "./rating/engine";
import type { SetScore } from "./set-score";

export interface MatchLogSnapshot {
  players: SnapshotPlayer[];
  matches: SnapshotMatch[];
  participants: SnapshotParticipant[];
  ratingHistory: SnapshotRatingHistory[];
  currentRatings: SnapshotCurrentRating[];
}

export interface SnapshotPlayer {
  id: string;
  name: string;
  retiredAt: Date | null;
  createdAt: Date;
}

export interface SnapshotMatch {
  id: string;
  playedAt: Date;
  loggedAt: Date;
  loggedBy: string;
  winnerSide: MatchSide;
  sets: SetScore[] | null;
}

export interface SnapshotParticipant {
  matchId: string;
  playerId: string | null;
  guestName: string | null;
  side: MatchSide;
  slot: number;
}

export interface SnapshotRatingHistory {
  matchId: string;
  playerId: string;
  side: MatchSide;
  ratingBefore: number;
  delta: number;
  ratingAfter: number;
  playedAt: Date;
}

export interface SnapshotCurrentRating {
  playerId: string;
  rating: number;
  competitiveMatchesPlayed: number;
  isRanked: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  rating: number;
  rank: number | null;
  wins: number;
  losses: number;
  matchesPlayed: number;
}

export type FeedParticipant =
  | {
      kind: "player";
      playerId: string;
      name: string;
      side: MatchSide;
      slot: number;
      ratingBefore: number;
      delta: number;
      ratingAfter: number;
    }
  | {
      kind: "guest";
      name: string;
      side: MatchSide;
      slot: number;
    };

export interface FeedMatch {
  id: string;
  playedAt: Date;
  loggedAt: Date;
  loggedBy: string;
  loggedByName: string;
  winnerSide: MatchSide;
  sets: SetScore[] | null;
  participants: FeedParticipant[];
}

export interface PlayerDetail {
  playerId: string;
  name: string;
  retired: boolean;
  rating: number;
  rank: number | null;
  wins: number;
  losses: number;
  ratingSeries: RatingPoint[];
  matches: FeedMatch[];
  headToHead: CompanionRecord[];
  partners: CompanionRecord[];
}

export interface CompanionRecord {
  playerId: string;
  name: string;
  wins: number;
  losses: number;
}

export interface RatingPoint {
  matchId: string;
  playedAt: Date;
  delta: number;
  ratingAfter: number;
}

export interface MatchLogProjection {
  feed(): FeedMatch[];
  leaderboard(): LeaderboardEntry[];
  playerDetail(playerId: string): PlayerDetail | null;
}

/**
 * Canonical in-memory read model over one immutable database snapshot.
 * Selectors share identity, ordering, delta, record, rank, and relationship
 * rules without persisting a third projection.
 */
export function createMatchLogProjection(
  snapshot: MatchLogSnapshot,
): MatchLogProjection {
  const nameById = new Map(
    snapshot.players.map((player) => [player.id, player.name]),
  );
  const playerById = new Map(
    snapshot.players.map((player) => [player.id, player]),
  );
  const currentById = new Map(
    snapshot.currentRatings.map((rating) => [rating.playerId, rating]),
  );
  const participantsByMatch = groupBy(
    snapshot.participants,
    (participant) => participant.matchId,
  );
  const historyByParticipant = new Map(
    snapshot.ratingHistory.map((history) => [
      `${history.matchId}:${history.playerId}`,
      history,
    ]),
  );
  const orderedMatches = [...snapshot.matches].sort(compareMatchesNewestFirst);
  const activeIds = new Set(
    snapshot.players
      .filter((player) => player.retiredAt === null)
      .map((player) => player.id),
  );
  const ranks = activeRankMap(snapshot.currentRatings, activeIds);
  const records = recordByPlayer(orderedMatches, participantsByMatch);

  function participantsFor(match: SnapshotMatch): FeedParticipant[] {
    return [...(participantsByMatch.get(match.id) ?? [])]
      .sort(
        (a, b) => a.side.localeCompare(b.side) || a.slot - b.slot,
      )
      .map((participant): FeedParticipant => {
        if (participant.playerId === null) {
          return {
            kind: "guest",
            name: participant.guestName ?? "Unknown Guest",
            side: participant.side,
            slot: participant.slot,
          };
        }
        const history = historyByParticipant.get(
          `${match.id}:${participant.playerId}`,
        );
        if (!history) {
          throw new Error(
            `Missing Rating history for Player ${participant.playerId} in Match ${match.id}`,
          );
        }
        return {
          kind: "player",
          playerId: participant.playerId,
          name: nameById.get(participant.playerId) ?? "Unknown",
          side: participant.side,
          slot: participant.slot,
          ratingBefore: history.ratingBefore,
          delta: history.delta,
          ratingAfter: history.ratingAfter,
        };
      });
  }

  function toFeedMatch(match: SnapshotMatch): FeedMatch {
    return {
      ...match,
      loggedByName: nameById.get(match.loggedBy) ?? "Unknown",
      participants: participantsFor(match),
    };
  }

  function feed(): FeedMatch[] {
    return orderedMatches.map(toFeedMatch);
  }

  function leaderboard(): LeaderboardEntry[] {
    return snapshot.players
      .filter((player) => player.retiredAt === null)
      .map((player) => {
        const rating = currentById.get(player.id);
        const record = records.get(player.id);
        return {
          playerId: player.id,
          name: player.name,
          rating: rating?.rating ?? STARTING_RATING,
          rank: ranks.get(player.id) ?? null,
          wins: record?.wins ?? 0,
          losses: record?.losses ?? 0,
          matchesPlayed: rating?.competitiveMatchesPlayed ?? 0,
        };
      })
      .sort(
        (a, b) =>
          (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
          b.rating - a.rating ||
          a.name.localeCompare(b.name),
      );
  }

  function playerDetail(playerId: string): PlayerDetail | null {
    const player = playerById.get(playerId);
    if (!player) return null;

    // Select before shaping Feed cards: Player Detail does not fold unrelated
    // matches merely to reuse the Feed selector.
    const played = orderedMatches
      .filter((match) =>
        (participantsByMatch.get(match.id) ?? []).some(
          (participant) => participant.playerId === playerId,
        ),
      )
      .map(toFeedMatch);
    const record = records.get(playerId);
    const rating = currentById.get(playerId);

    return {
      playerId,
      name: player.name,
      retired: player.retiredAt !== null,
      rating: rating?.rating ?? STARTING_RATING,
      rank: ranks.get(playerId) ?? null,
      wins: record?.wins ?? 0,
      losses: record?.losses ?? 0,
      ratingSeries: played
        .map((match) => {
          const participant = match.participants.find(
            (candidate) =>
              candidate.kind === "player" &&
              candidate.playerId === playerId,
          ) as Extract<FeedParticipant, { kind: "player" }>;
          return {
            matchId: match.id,
            playedAt: match.playedAt,
            delta: participant.delta,
            ratingAfter: participant.ratingAfter,
          };
        })
        .reverse(),
      matches: played,
      headToHead: companionRecords(played, playerId, "opposite"),
      partners: companionRecords(played, playerId, "same"),
    };
  }

  return { feed, leaderboard, playerDetail };
}

function compareMatchesNewestFirst(
  a: SnapshotMatch,
  b: SnapshotMatch,
): number {
  return (
    b.playedAt.getTime() - a.playedAt.getTime() ||
    b.loggedAt.getTime() - a.loggedAt.getTime() ||
    (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  );
}

function activeRankMap(
  ratings: SnapshotCurrentRating[],
  activeIds: ReadonlySet<string>,
): Map<string, number> {
  const ranked = ratings
    .filter((rating) => rating.isRanked && activeIds.has(rating.playerId))
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0),
    );
  return new Map(ranked.map((rating, index) => [rating.playerId, index + 1]));
}

function recordByPlayer(
  matches: SnapshotMatch[],
  participantsByMatch: ReadonlyMap<string, SnapshotParticipant[]>,
): Map<string, { wins: number; losses: number }> {
  const records = new Map<string, { wins: number; losses: number }>();
  for (const match of matches) {
    for (const participant of participantsByMatch.get(match.id) ?? []) {
      if (participant.playerId === null) continue;
      const record = records.get(participant.playerId) ?? {
        wins: 0,
        losses: 0,
      };
      if (participant.side === match.winnerSide) record.wins++;
      else record.losses++;
      records.set(participant.playerId, record);
    }
  }
  return records;
}

function companionRecords(
  played: FeedMatch[],
  playerId: string,
  relation: "opposite" | "same",
): CompanionRecord[] {
  const records = new Map<string, CompanionRecord>();
  for (const match of played) {
    const mySide = match.participants.find(
      (participant) =>
        participant.kind === "player" && participant.playerId === playerId,
    )!.side;
    const won = mySide === match.winnerSide;
    const companions = match.participants.filter(
      (
        participant,
      ): participant is Extract<FeedParticipant, { kind: "player" }> =>
        participant.kind === "player" &&
        (relation === "opposite"
          ? participant.side !== mySide
          : participant.side === mySide &&
            participant.playerId !== playerId),
    );
    for (const companion of companions) {
      const record = records.get(companion.playerId) ?? {
        playerId: companion.playerId,
        name: companion.name,
        wins: 0,
        losses: 0,
      };
      if (won) record.wins++;
      else record.losses++;
      records.set(companion.playerId, record);
    }
  }
  return [...records.values()].sort(
    (a, b) =>
      b.wins + b.losses - (a.wins + a.losses) ||
      a.name.localeCompare(b.name),
  );
}

function groupBy<T>(
  values: T[],
  keyOf: (value: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    const group = grouped.get(key) ?? [];
    group.push(value);
    grouped.set(key, group);
  }
  return grouped;
}
