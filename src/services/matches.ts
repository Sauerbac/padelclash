import { asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "./db";
import {
  currentRating,
  matches,
  matchParticipants,
  players,
  ratingHistory,
  type Match,
  type RatingHistoryRow,
  type SetScore,
} from "./db/schema";
import {
  projectGroup,
  rankMap,
  STARTING_RATING,
  type CurrentRating,
  type EngineMatch,
  type MatchSide,
  type PlayerId,
} from "../domain/rating/engine";
import { canModifyMatch, type MatchActor } from "../domain/edit-rights";
import {
  validateMatchIntake,
  type ValidatedMatchParticipant,
} from "../domain/match-intake";
import type { MatchParticipant } from "../domain/match-participant";

export class MatchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatchValidationError";
  }
}

export interface LogMatchInput {
  /** Client-generated UUIDv7 — the offline-sync idempotency key. */
  id: string;
  playedAt: Date;
  /** The Logger: the player bound to the logging device. */
  loggedBy: string;
  /** Discriminated Player/Guest participants per Side. */
  sides: Record<MatchSide, MatchParticipant[]>;
  winnerSide: MatchSide;
  /** Set Score detail; omit for a Simple Result. */
  sets?: SetScore[] | null;
}

export interface LoggedMatch {
  match: Match;
  /** This match's rating_history rows — the post-submit payoff. */
  deltas: RatingHistoryRow[];
  /** True when the id already existed (an offline-sync retry): nothing was re-logged. */
  alreadyLogged: boolean;
}

// Serializes writers to the match log (see logMatch). Arbitrary app-unique key.
const MATCH_LOG_LOCK_KEY = 7_454_001;

/**
 * Append a match to the log and synchronously rebuild both projections
 * (spec "Rating engine"): the whole log is replayed and rating_history +
 * current_rating are rewritten in the SAME transaction as the insert, so
 * readers never see a match without its ratings.
 */
export async function logMatch(
  db: Db,
  input: LogMatchInput,
): Promise<LoggedMatch> {
  return db.transaction(async (tx) => {
    // Writers must run one at a time: under READ COMMITTED, two concurrent
    // logs would each replay a log missing the other's match, and the second
    // commit would overwrite the projections with that stale replay. The
    // advisory lock is transaction-scoped (released on commit/rollback) and
    // doesn't block readers.
    await tx.execute(sql`select pg_advisory_xact_lock(${MATCH_LOG_LOCK_KEY})`);
    const normalizedSides = await validateIntake(tx, input);

    const [match] = await tx
      .insert(matches)
      .values({
        id: input.id,
        playedAt: input.playedAt,
        loggedBy: input.loggedBy,
        winnerSide: input.winnerSide,
        sets: input.sets ?? null,
      })
      .onConflictDoNothing()
      .returning();

    // Conflict on the client-generated id = an offline-sync retry. Return the
    // stored result untouched — replaying an insert must not double-log.
    if (!match) {
      const [existing] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, input.id));
      return {
        match: existing,
        deltas: await deltasOf(tx, input.id),
        alreadyLogged: true,
      };
    }

    await tx
      .insert(matchParticipants)
      .values(participantInsertRows(match.id, normalizedSides));

    await replayProjections(tx);

    return {
      match,
      deltas: await deltasOf(tx, match.id),
      alreadyLogged: false,
    };
  });
}

export interface EditMatchInput {
  /** Id of the match being corrected. */
  id: string;
  playedAt: Date;
  sides: Record<MatchSide, MatchParticipant[]>;
  winnerSide: MatchSide;
  sets?: SetScore[] | null;
}

export interface EditedMatch {
  match: Match;
  /** The corrected match's rating_history rows, post-replay. */
  deltas: RatingHistoryRow[];
}

/**
 * Correct a logged match: every played-fact is replaceable (playedAt, sides,
 * winner, sets); id, loggedBy and loggedAt are history and never change.
 * Edit rights are enforced here, inside the transaction, and projections are
 * replayed in the same transaction, exactly like logMatch.
 */
export async function editMatch(
  db: Db,
  input: EditMatchInput,
  actor: MatchActor,
  now: Date = new Date(),
): Promise<EditedMatch> {
  return db.transaction(async (tx) => {
    // Same writer serialization as logMatch (see there).
    await tx.execute(sql`select pg_advisory_xact_lock(${MATCH_LOG_LOCK_KEY})`);

    await requireModifiableMatch(tx, input.id, actor, now, "edit");
    const normalizedSides = await validateIntake(tx, input);

    const [match] = await tx
      .update(matches)
      .set({
        playedAt: input.playedAt,
        winnerSide: input.winnerSide,
        sets: input.sets ?? null,
      })
      .where(eq(matches.id, input.id))
      .returning();

    // Participants are replaced wholesale — simpler than diffing sides.
    await tx
      .delete(matchParticipants)
      .where(eq(matchParticipants.matchId, input.id));
    await tx
      .insert(matchParticipants)
      .values(participantInsertRows(input.id, normalizedSides));

    await replayProjections(tx);

    return { match, deltas: await deltasOf(tx, input.id) };
  });
}

/**
 * Delete a match from the log (spec "Match": a deleted match is a deleted
 * row — FK cascade removes participants and history) and replay projections
 * in the same transaction, exactly like logMatch. Edit rights are enforced
 * here, inside the transaction, not just in the UI.
 */
export async function deleteMatch(
  db: Db,
  matchId: string,
  actor: MatchActor,
  now: Date = new Date(),
): Promise<void> {
  return db.transaction(async (tx) => {
    // Same writer serialization as logMatch: a writer that skips the lock
    // could commit a replay that misses a concurrent write.
    await tx.execute(sql`select pg_advisory_xact_lock(${MATCH_LOG_LOCK_KEY})`);

    await requireModifiableMatch(tx, matchId, actor, now, "delete");

    await tx.delete(matches).where(eq(matches.id, matchId));
    await replayProjections(tx);
  });
}

// The shared edit/delete preamble: the match must exist and the actor must
// hold edit rights (spec "Edit rights"). Call after taking the write lock.
async function requireModifiableMatch(
  tx: Db,
  matchId: string,
  actor: MatchActor,
  now: Date,
  action: "edit" | "delete",
): Promise<void> {
  const [match] = await tx
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));
  if (!match) throw new Error("Match not found");
  if (!canModifyMatch(match, actor, now)) {
    throw new Error(
      `Only the Logger (within 24 h) or the admin can ${action} a match`,
    );
  }
}

function deltasOf(tx: Db, matchId: string): Promise<RatingHistoryRow[]> {
  return tx
    .select()
    .from(ratingHistory)
    .where(eq(ratingHistory.matchId, matchId));
}

async function validateIntake(
  tx: Db,
  input: Pick<LogMatchInput, "sides" | "winnerSide" | "sets">,
): Promise<Record<MatchSide, ValidatedMatchParticipant[]>> {
  const roster = await tx
    .select({
      id: players.id,
      name: players.name,
    })
    .from(players);
  const validation = validateMatchIntake(
    {
      sides: input.sides,
      winnerSide: input.winnerSide,
      sets: input.sets ?? null,
    },
    {
      // Includes Retired Players: a Match queued while active may sync later.
      playerIds: roster.map(({ id }) => id),
      reservedPlayerNames: roster.map(({ name }) => name),
    },
  );
  if (!validation.ok) {
    throw new MatchValidationError(validation.error.message);
  }
  return validation.sides;
}

function participantValues(participant: ValidatedMatchParticipant): {
  playerId: string | null;
  guestName: string | null;
  guestNormalizedName: string | null;
} {
  return participant.kind === "player"
    ? {
        playerId: participant.playerId,
        guestName: null,
        guestNormalizedName: null,
      }
    : {
        playerId: null,
        guestName: participant.name,
        guestNormalizedName: participant.normalizedName,
      };
}

function participantInsertRows(
  matchId: string,
  sides: Record<MatchSide, ValidatedMatchParticipant[]>,
) {
  return (["A", "B"] as const).flatMap((side) =>
    sides[side].map((participant, slot) => ({
      matchId,
      side,
      slot,
      ...participantValues(participant),
    })),
  );
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  rating: number;
  /** 1-based leaderboard rank; null while below the ranked threshold. */
  rank: number | null;
  wins: number;
  losses: number;
  matchesPlayed: number;
}

/**
 * The Leaderboard read (spec "Screens"): every active player — ranked players
 * first in rank order (rankMap is the single definition of ordering), then the
 * unranked below, highest rating first. Players yet to play appear unranked at
 * the starting rating with a 0–0 record.
 */
export async function getLeaderboard(db: Db): Promise<LeaderboardEntry[]> {
  const [roster, ratingRows, results] = await Promise.all([
    db
      .select()
      .from(players)
      .where(isNull(players.retiredAt))
      .orderBy(asc(players.createdAt)),
    db.select().from(currentRating),
    // W–L comes straight from the log, not the projections.
    db
      .select({
        playerId: matchParticipants.playerId,
        side: matchParticipants.side,
        winnerSide: matches.winnerSide,
      })
      .from(matchParticipants)
      .innerJoin(matches, eq(matchParticipants.matchId, matches.id)),
  ]);

  const current = new Map<PlayerId, CurrentRating>(
    ratingRows.map((r) => [r.playerId, r]),
  );
  const ranks = activeRankMap(current, roster);

  const record = new Map<string, { wins: number; losses: number }>();
  for (const r of results) {
    if (r.playerId === null) continue;
    const tally = record.get(r.playerId) ?? { wins: 0, losses: 0 };
    if (r.side === r.winnerSide) tally.wins++;
    else tally.losses++;
    record.set(r.playerId, tally);
  }

  const entries = roster.map((player) => {
    const rating = current.get(player.id);
    const tally = record.get(player.id);
    return {
      playerId: player.id,
      name: player.name,
      rating: rating?.rating ?? STARTING_RATING,
      rank: ranks.get(player.id) ?? null,
      wins: tally?.wins ?? 0,
      losses: tally?.losses ?? 0,
      matchesPlayed: rating?.competitiveMatchesPlayed ?? 0,
    };
  });

  return entries.sort(
    (a, b) =>
      (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
      b.rating - a.rating ||
      a.name.localeCompare(b.name),
  );
}

/**
 * Rank is a property of the active leaderboard (decision log 2026-07-12):
 * retired players hold no rank and leave no numbering gap, though their
 * ratings stay in the projections and their pages stay reachable.
 */
function activeRankMap(
  current: ReadonlyMap<PlayerId, CurrentRating>,
  activePlayers: { id: string }[],
): Map<PlayerId, number> {
  const active = new Set(activePlayers.map((p) => p.id));
  return rankMap(
    new Map([...current].filter(([playerId]) => active.has(playerId))),
  );
}

export interface MatchWithSides {
  match: Match;
  /** Complete participant list; Guests are plain match-scoped names. */
  participants: MatchParticipantRead[];
}

export type MatchParticipantRead =
  | {
      kind: "player";
      playerId: string;
      name: string;
      side: MatchSide;
      slot: number;
    }
  | {
      kind: "guest";
      name: string;
      side: MatchSide;
      slot: number;
    };

function toParticipantRead(row: {
  playerId: string | null;
  playerName: string | null;
  guestName: string | null;
  side: MatchSide;
  slot: number;
}): MatchParticipantRead {
  return row.playerId === null
    ? {
        kind: "guest",
        name: row.guestName ?? "Unknown Guest",
        side: row.side,
        slot: row.slot,
      }
    : {
        kind: "player",
        playerId: row.playerId,
        name: row.playerName ?? "Unknown",
        side: row.side,
        slot: row.slot,
      };
}

// Ids arriving from URLs are junk until proven uuid — pg throws on the cast.
function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}

/** A single match by id — the edit screen's read. Null when it doesn't exist. */
export async function getMatch(
  db: Db,
  matchId: string,
): Promise<MatchWithSides | null> {
  if (!isUuid(matchId)) return null;

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));
  if (!match) return null;

  const participants = await db
    .select({
      playerId: matchParticipants.playerId,
      playerName: players.name,
      guestName: matchParticipants.guestName,
      side: matchParticipants.side,
      slot: matchParticipants.slot,
    })
    .from(matchParticipants)
    .leftJoin(players, eq(matchParticipants.playerId, players.id))
    .where(eq(matchParticipants.matchId, matchId))
    .orderBy(asc(matchParticipants.side), asc(matchParticipants.slot));

  return { match, participants: participants.map(toParticipantRead) };
}

export type FeedParticipant =
  | (Extract<MatchParticipantRead, { kind: "player" }> & {
      ratingBefore: number;
      delta: number;
      ratingAfter: number;
    })
  | Extract<MatchParticipantRead, { kind: "guest" }>;

export interface FeedMatch {
  id: string;
  playedAt: Date;
  loggedAt: Date;
  loggedBy: string;
  /**
   * Display name for `loggedBy` — the Logger attribution Admin sees (spec
   * decision 53). Resolved here because the Logger need not be a participant,
   * so the card's own name list can't be relied on to contain them.
   */
  loggedByName: string;
  winnerSide: MatchSide;
  sets: SetScore[] | null;
  participants: FeedParticipant[];
}

/**
 * The Feed read (spec "Screens"): every match, newest first by the replay's
 * total order (playedAt, loggedAt, id). Participants and their deltas come
 * straight from rating_history — the projection already holds one row per
 * participant per match. Names join the full roster: retired players keep
 * their name in old matches.
 */
export async function getFeed(db: Db): Promise<FeedMatch[]> {
  const [matchRows, participantRows, historyRows, roster] = await Promise.all([
    db
      .select()
      .from(matches)
      .orderBy(
        desc(matches.playedAt),
        desc(matches.loggedAt),
        desc(matches.id),
      ),
    db.select().from(matchParticipants),
    db.select().from(ratingHistory),
    db.select().from(players),
  ]);

  const nameById = new Map(roster.map((p) => [p.id, p.name]));
  const byMatch = new Map<string, RatingHistoryRow[]>();
  for (const row of historyRows) {
    const rows = byMatch.get(row.matchId) ?? [];
    rows.push(row);
    byMatch.set(row.matchId, rows);
  }
  const participantsByMatch = new Map<string, typeof participantRows>();
  for (const row of participantRows) {
    const rows = participantsByMatch.get(row.matchId) ?? [];
    rows.push(row);
    participantsByMatch.set(row.matchId, rows);
  }

  return matchRows.map((m) => ({
    id: m.id,
    playedAt: m.playedAt,
    loggedAt: m.loggedAt,
    loggedBy: m.loggedBy,
    loggedByName: nameById.get(m.loggedBy) ?? "Unknown",
    winnerSide: m.winnerSide,
    sets: m.sets,
    participants: (participantsByMatch.get(m.id) ?? [])
      .sort((a, b) => a.side.localeCompare(b.side) || a.slot - b.slot)
      .map((participant): FeedParticipant => {
        if (participant.playerId === null) {
          return {
            kind: "guest",
            name: participant.guestName ?? "Unknown Guest",
            side: participant.side,
            slot: participant.slot,
          };
        }
        const history = (byMatch.get(m.id) ?? []).find(
          (row) => row.playerId === participant.playerId,
        );
        if (!history) {
          // Total coverage holds only because replayProjections hardcodes
          // competitive/confirmed. projectGroup filters casual and voided
          // matches out of the projection, so the day the casual flag ships
          // (spec Later list) this read needs a Player-without-delta shape —
          // the one a Guest already uses — not a throw.
          throw new Error(
            `Missing Rating history for Player ${participant.playerId} in Match ${m.id}`,
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
      }),
  }));
}

export interface PlayerDetail {
  playerId: string;
  name: string;
  retired: boolean;
  rating: number;
  /** 1-based leaderboard rank; null while below the ranked threshold. */
  rank: number | null;
  wins: number;
  losses: number;
  /** One point per match in replay (chronological) order — the chart's data. */
  ratingSeries: RatingPoint[];
  /** This player's match history, newest first — feed-card shape for reuse. */
  matches: FeedMatch[];
  /** Record vs each opponent faced, most-faced first (spec: head-to-head). */
  headToHead: CompanionRecord[];
  /** Record with each doubles partner, most-played-with first. */
  partners: CompanionRecord[];
}

/** This player's record vs an opponent — or with a doubles partner. */
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

/**
 * The Player Detail read (spec "Screens"): the full stats package for one
 * player, all derived from the log and the projections. Retired players keep
 * their page (history links to them). Null for unknown or non-uuid ids.
 */
export async function getPlayerDetail(
  db: Db,
  playerId: string,
): Promise<PlayerDetail | null> {
  if (!isUuid(playerId)) return null;

  const [roster, ratingRows, feed] = await Promise.all([
    db.select().from(players),
    db.select().from(currentRating),
    getFeed(db),
  ]);
  const player = roster.find((p) => p.id === playerId);
  if (!player) return null;

  const current = new Map<PlayerId, CurrentRating>(
    ratingRows.map((r) => [r.playerId, r]),
  );
  const rating = current.get(playerId);

  // The player's own matches, newest first (feed order).
  const played = feed.filter((m) =>
    m.participants.some((p) => p.kind === "player" && p.playerId === playerId),
  );
  const wins = played.filter((m) =>
    m.participants.some(
      (p) =>
        p.kind === "player" &&
        p.playerId === playerId &&
        p.side === m.winnerSide,
    ),
  ).length;

  return {
    playerId,
    name: player.name,
    retired: player.retiredAt !== null,
    rating: rating?.rating ?? STARTING_RATING,
    rank:
      activeRankMap(
        current,
        roster.filter((p) => p.retiredAt === null),
      ).get(playerId) ?? null,
    wins,
    losses: played.length - wins,
    // The feed is newest-first in the replay's total order, so reversing it
    // is exactly chronological — late-synced matches sit where they belong.
    ratingSeries: played
      .map((m) => {
        const me = m.participants.find(
          (p) => p.kind === "player" && p.playerId === playerId,
        ) as Extract<FeedParticipant, { kind: "player" }>;
        return {
          matchId: m.id,
          playedAt: m.playedAt,
          delta: me.delta,
          ratingAfter: me.ratingAfter,
        };
      })
      .reverse(),
    matches: played,
    headToHead: companionRecords(played, playerId, "opposite"),
    partners: companionRecords(played, playerId, "same"),
  };
}

// Fold the player's matches into per-companion W–L tallies: "opposite" side
// companions are opponents (head-to-head), "same" side are doubles partners.
// Most-played-together first, ties by name.
function companionRecords(
  played: FeedMatch[],
  playerId: string,
  relation: "opposite" | "same",
): CompanionRecord[] {
  const records = new Map<string, CompanionRecord>();
  for (const match of played) {
    const mySide = match.participants.find(
      (p) => p.kind === "player" && p.playerId === playerId,
    )!.side;
    const won = mySide === match.winnerSide;
    const companions = match.participants.filter(
      (participant): participant is Extract<
        FeedParticipant,
        { kind: "player" }
      > =>
        participant.kind === "player" &&
        (relation === "opposite"
          ? participant.side !== mySide
          : participant.side === mySide &&
            participant.playerId !== playerId),
    );
    for (const c of companions) {
      const record = records.get(c.playerId) ?? {
        playerId: c.playerId,
        name: c.name,
        wins: 0,
        losses: 0,
      };
      if (won) record.wins++;
      else record.losses++;
      records.set(c.playerId, record);
    }
  }
  return [...records.values()].sort(
    (a, b) =>
      b.wins + b.losses - (a.wins + a.losses) || a.name.localeCompare(b.name),
  );
}

/**
 * Replay the full match log through the pure engine and rewrite both
 * projection tables. Must run inside the transaction that changed the log.
 */
export async function rebuildRatingProjections(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${MATCH_LOG_LOCK_KEY})`);
    await replayProjections(tx);
  });
}

async function replayProjections(tx: Db): Promise<void> {
  const [matchRows, participantRows] = await Promise.all([
    tx.select().from(matches),
    tx.select().from(matchParticipants),
  ]);

  const sidesByMatch = new Map<
    string,
    Record<MatchSide, MatchParticipant[]>
  >();
  for (const p of participantRows) {
    const sides = sidesByMatch.get(p.matchId) ?? { A: [], B: [] };
    sides[p.side].push(
      p.playerId === null
        ? { kind: "guest", name: p.guestName ?? "Unknown Guest" }
        : { kind: "player", playerId: p.playerId },
    );
    sidesByMatch.set(p.matchId, sides);
  }

  const engineMatches: EngineMatch[] = matchRows.map((m) => ({
    id: m.id,
    playedAt: m.playedAt,
    loggedAt: m.loggedAt,
    // Lite v1 only ever produces competitive/confirmed (spec "Rating engine").
    classification: "competitive",
    status: "confirmed",
    sides: sidesByMatch.get(m.id) ?? { A: [], B: [] },
    winnerSide: m.winnerSide,
    sets: m.sets,
  }));

  const projection = projectGroup(engineMatches);

  await tx.delete(ratingHistory);
  await tx.delete(currentRating);
  if (projection.ratingHistory.length > 0) {
    await tx.insert(ratingHistory).values(projection.ratingHistory);
  }
  const currentRows = [...projection.currentRating.values()];
  if (currentRows.length > 0) {
    await tx.insert(currentRating).values(currentRows);
  }
}
