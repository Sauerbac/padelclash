// The app's write spine (module-structure.md, "The mutation path"). One Postgres
// transaction: validate → insert the source-of-truth `match` + `match_participant`
// rows → replay the group's whole stream through the pure engine → DELETE and
// bulk-insert the `rating_history` + `current_rating` projection → commit.
//
// services/ is the ONLY layer that knows both the domain and the database. The
// transaction is the dangerous part, so it has exactly one home: here. The engine
// stays pure (src/domain), the Server Action above stays thin (slice 05).
//
// The projection is a formal cache (ADR-0007): every mutation to a group's log
// rebuilds that group from scratch inside the same transaction, so the cache can
// never drift from the log. Full replay, not replay-from-change-point — cheap
// enough to skip the optimization for years (rating-engine.md, "Rebuild mechanism").

import { eq, inArray } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import { newId } from "@/db/ids";
import {
  currentRating,
  group,
  match,
  matchParticipant,
  ratingHistory,
} from "@/db/schema";
import {
  projectGroup,
  type EngineMatch,
  type MatchSide,
} from "@/domain/rating/engine";

export interface LogMatchPlayer {
  side: MatchSide;
  playerId: string;
}

export interface LogMatchInput {
  groupId: string;
  /** One entry per participant; one per side = singles, two = doubles. */
  players: LogMatchPlayer[];
  winnerSide: MatchSide;
  /** Player id of whoever logged the match (the `logged_by` audit column). */
  loggedBy: string;
  /** Casual matches are stored but never affect ratings (excluded from replay). */
  classification?: "competitive" | "casual";
  /** Defaults to now. Editable later; drives replay ordering. */
  playedAt?: Date;
}

export interface LogMatchResult {
  matchId: string;
}

/** The transaction handle passed to a `db.transaction(...)` callback. */
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Log a match and rebuild its group's rating projection, atomically.
 *
 * `db` is injectable so the Tier-3 integration test can target a separate test
 * database; production callers use the default pooled client.
 */
export async function logMatch(
  input: LogMatchInput,
  db: Database = getDb(),
): Promise<LogMatchResult> {
  validate(input);

  return db.transaction(async (tx) => {
    const [grp] = await tx
      .select()
      .from(group)
      .where(eq(group.id, input.groupId));
    if (!grp) {
      throw new Error(`logMatch: group ${input.groupId} not found`);
    }

    const matchId = newId();
    const playedAt = input.playedAt ?? new Date();
    const classification = input.classification ?? "competitive";

    // 1. Insert the source of truth. Simple-result format: the winner is promoted
    //    to its own column (ADR-0003), so the jsonb payload carries no detail.
    //    Trust-mode confirmation is a later slice; a logged match is `confirmed`
    //    for now (status does not affect replay — only `voided` is excluded).
    //    See docs/open-questions/03-new-match-confirmation-status.md.
    await tx.insert(match).values({
      id: matchId,
      groupId: input.groupId,
      playedAt,
      loggedBy: input.loggedBy,
      classification,
      status: "confirmed",
      resultFormat: "simple",
      result: {},
      winnerSide: input.winnerSide,
    });
    await tx.insert(matchParticipant).values(
      input.players.map((p) => ({
        matchId,
        playerId: p.playerId,
        side: p.side,
      })),
    );

    // 2. Replay the whole group from its log (the engine filters casual + voided).
    const stream = await loadStream(tx, input.groupId);
    const projection = projectGroup(stream, {
      rankedThreshold: grp.rankedThreshold,
    });

    // 3. Drop and rebuild the group's projection rows in the same transaction.
    await tx.delete(ratingHistory).where(eq(ratingHistory.groupId, input.groupId));
    await tx.delete(currentRating).where(eq(currentRating.groupId, input.groupId));

    if (projection.ratingHistory.length > 0) {
      await tx.insert(ratingHistory).values(
        projection.ratingHistory.map((o) => ({
          groupId: input.groupId,
          matchId: o.matchId,
          playerId: o.playerId,
          side: o.side,
          // numeric columns take a string; the engine's full-precision floats
          // round-trip exactly through Postgres `numeric` (rating-engine.md).
          ratingBefore: String(o.ratingBefore),
          delta: String(o.delta),
          ratingAfter: String(o.ratingAfter),
          wasProvisional: o.wasProvisional,
          winProbability: String(o.winProbability),
          playedAt: o.playedAt,
        })),
      );
    }

    const current = [...projection.currentRating.values()];
    if (current.length > 0) {
      await tx.insert(currentRating).values(
        current.map((c) => ({
          groupId: input.groupId,
          playerId: c.playerId,
          rating: String(c.rating),
          competitiveMatchesPlayed: c.competitiveMatchesPlayed,
          matchesSinceReset: c.matchesSinceReset,
          isProvisional: c.isProvisional,
          isRanked: c.isRanked,
          lastMatchAt: c.lastMatchAt,
        })),
      );
    }

    return { matchId };
  });
}

/** Reject malformed input before any write. Throws on the first problem. */
function validate(input: LogMatchInput): void {
  if (input.winnerSide !== "A" && input.winnerSide !== "B") {
    throw new Error(`logMatch: winnerSide must be "A" or "B"`);
  }
  const bySide: Record<MatchSide, number> = { A: 0, B: 0 };
  const seen = new Set<string>();
  for (const p of input.players) {
    if (p.side !== "A" && p.side !== "B") {
      throw new Error(`logMatch: player side must be "A" or "B"`);
    }
    if (seen.has(p.playerId)) {
      throw new Error(`logMatch: player ${p.playerId} appears more than once`);
    }
    seen.add(p.playerId);
    bySide[p.side]++;
  }
  if (bySide.A === 0 || bySide.B === 0) {
    throw new Error("logMatch: each side needs at least one player");
  }
}

/**
 * Read a group's entire match log into the engine's input shape. Returns ALL
 * matches (including casual and voided) — `projectGroup` owns the filtering, so
 * the inclusion rules live in exactly one place (the engine).
 */
async function loadStream(tx: Tx, groupId: string): Promise<EngineMatch[]> {
  const matchRows = await tx.select().from(match).where(eq(match.groupId, groupId));
  if (matchRows.length === 0) return [];

  const participantRows = await tx
    .select()
    .from(matchParticipant)
    .where(
      inArray(
        matchParticipant.matchId,
        matchRows.map((m) => m.id),
      ),
    );

  const sidesByMatch = new Map<string, { A: string[]; B: string[] }>();
  for (const m of matchRows) sidesByMatch.set(m.id, { A: [], B: [] });
  for (const p of participantRows) {
    sidesByMatch.get(p.matchId)![p.side].push(p.playerId);
  }

  return matchRows.map((m) => {
    if (m.winnerSide === null) {
      // Every match has a winner (ADR-0003); a null here is a corrupt row.
      throw new Error(`logMatch: match ${m.id} has no winner`);
    }
    return {
      id: m.id,
      playedAt: m.playedAt,
      loggedAt: m.loggedAt,
      classification: m.classification,
      status: m.status,
      sides: sidesByMatch.get(m.id)!,
      winnerSide: m.winnerSide,
    };
  });
}
