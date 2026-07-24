import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import type { Db } from "./db";
import {
  matches,
  matchParticipants,
  onboardingInvitations,
  players,
  type Player,
} from "./db/schema";
import { normalizePlayerName } from "../domain/player-name";
import {
  isInvitationValid,
  playerStatus,
  type PlayerStatus,
} from "../domain/onboarding";
import {
  getActiveBinding,
  listActiveBindings,
  lockOnboarding,
  revokeActiveBinding,
  revokePersonalInvitation,
} from "./access";
import {
  isUniqueViolation,
  PlayerNameError,
  PlayerNotFoundError,
  PlayerReferencedError,
} from "./errors";

const NORMALIZED_NAME_CONSTRAINT = "players_normalized_name_key";

/**
 * Add a Player to the roster. They start Not Joined with no invitation —
 * Admin issues a Personal Link separately when they want one (decision 41).
 * Takes a `Db`, so the General Link's create-and-join path can call it inside
 * its confirmation transaction.
 */
export async function createPlayer(db: Db, name: string): Promise<Player> {
  const parsed = normalizePlayerName(name);
  if (!parsed.ok) throw new PlayerNameError(parsed.problem);

  try {
    const [player] = await db
      .insert(players)
      .values({
        name: parsed.name.display,
        normalizedName: parsed.name.normalized,
      })
      .returning();
    return player;
  } catch (err) {
    // The unique index, not a prior SELECT, is what actually decides a race
    // between two attendees typing the same name into the General Link.
    if (isUniqueViolation(err, NORMALIZED_NAME_CONSTRAINT)) {
      throw new PlayerNameError("name-taken");
    }
    throw err;
  }
}

/** Rename a Player; Retired Players keep reserving their name (decision 30). */
export async function renamePlayer(
  db: Db,
  playerId: string,
  name: string,
): Promise<Player> {
  const parsed = normalizePlayerName(name);
  if (!parsed.ok) throw new PlayerNameError(parsed.problem);

  try {
    const [player] = await db
      .update(players)
      .set({
        name: parsed.name.display,
        normalizedName: parsed.name.normalized,
      })
      .where(eq(players.id, playerId))
      .returning();
    if (!player) throw new PlayerNotFoundError(playerId);
    return player;
  } catch (err) {
    if (isUniqueViolation(err, NORMALIZED_NAME_CONSTRAINT)) {
      throw new PlayerNameError("name-taken");
    }
    throw err;
  }
}

export async function listPlayers(db: Db): Promise<Player[]> {
  return db.select().from(players).orderBy(asc(players.createdAt));
}

// Active = not retired; what pickers (match form, General Link) show.
export async function listActivePlayers(db: Db): Promise<Player[]> {
  return db
    .select()
    .from(players)
    .where(isNull(players.retiredAt))
    .orderBy(asc(players.createdAt));
}

/** Not Joined = on the roster, not retired, holding no binding (decision 29). */
export async function listNotJoinedPlayers(db: Db): Promise<Player[]> {
  const bound = new Set(
    (await listActiveBindings(db)).map((b) => b.playerId),
  );
  return (await listActivePlayers(db)).filter((p) => !bound.has(p.id));
}

export async function getPlayerById(
  db: Db,
  playerId: string,
): Promise<Player | null> {
  // The id may come from a URL or a form field; an arbitrary string would make
  // pg throw on the uuid cast, so pre-validate instead.
  if (!isUuid(playerId)) return null;
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId));
  return player ?? null;
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}

/**
 * Retire a Player: they leave the pickers, keep their history and their name,
 * and lose access. Retirement is one of the ways Admin ends a binding
 * (decision 39), so it revokes the binding and any outstanding Personal Link
 * in the same transaction — a retired Player must not be able to walk back in
 * through a link that was already in their inbox.
 */
export async function retirePlayer(db: Db, playerId: string): Promise<Player> {
  return db.transaction(async (tx) => {
    // Serialized against join confirmation: otherwise a confirmation that had
    // already validated this Player could insert a binding just after the
    // revoke below, leaving a retired Player holding live access.
    await lockOnboarding(tx);

    const now = new Date();
    const [player] = await tx
      .update(players)
      .set({ retiredAt: now })
      .where(eq(players.id, playerId))
      .returning();
    if (!player) throw new PlayerNotFoundError(playerId);

    await revokeActiveBinding(tx, playerId, now);
    await revokePersonalInvitation(tx, playerId, now);
    return player;
  });
}

/**
 * Restore a Retired Player to Not Joined (decision 35). History and name come
 * back; access does not.
 *
 * The binding revoke here is not redundant with retirePlayer's. Clearing
 * `retired_at` re-activates any binding row that is still un-revoked, and a
 * retired Player's binding was only ever *inert* — resolveCredential refuses
 * retired Players rather than the row being gone. Revoking on the way back in
 * makes "restoration never restores access" true by construction instead of
 * true by assumption about how the Player got retired.
 */
export async function restorePlayer(db: Db, playerId: string): Promise<Player> {
  return db.transaction(async (tx) => {
    await lockOnboarding(tx);

    const now = new Date();
    await revokeActiveBinding(tx, playerId, now);

    const [player] = await tx
      .update(players)
      .set({ retiredAt: null })
      .where(eq(players.id, playerId))
      .returning();
    if (!player) throw new PlayerNotFoundError(playerId);
    return player;
  });
}

/**
 * Whether the match log still references this Player, as a participant or as
 * the Logger. The one thing that blocks permanent deletion (decision 31);
 * onboarding state and browsing deliberately do not.
 */
export async function isPlayerDeletable(
  db: Db,
  playerId: string,
): Promise<boolean> {
  if (!isUuid(playerId)) return false;
  return (await referencedPlayerIds(db)).has(playerId) === false;
}

/** One query for the whole roster — the Admin view needs every row's flag. */
async function referencedPlayerIds(db: Db): Promise<Set<string>> {
  const [participants, loggers] = await Promise.all([
    db
      .selectDistinct({ playerId: matchParticipants.playerId })
      .from(matchParticipants),
    db.selectDistinct({ playerId: matches.loggedBy }).from(matches),
  ]);
  return new Set(
    [...participants, ...loggers]
      .map((row) => row.playerId)
      .filter((playerId): playerId is string => playerId !== null),
  );
}

/**
 * Permanently delete an unreferenced Player. Bindings and invitations cascade;
 * a Player the log mentions can only be retired, until those Matches are gone.
 */
export async function deletePlayer(db: Db, playerId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const player = await getPlayerById(tx, playerId);
    if (!player) throw new PlayerNotFoundError(playerId);

    // Re-checked inside the transaction: a match logged between the Admin
    // screen rendering "delete" and the click must still win.
    const [{ referenced }] = await tx
      .select({ referenced: sql<boolean>`count(*) > 0` })
      .from(matches)
      .leftJoin(
        matchParticipants,
        eq(matchParticipants.matchId, matches.id),
      )
      .where(
        or(
          eq(matches.loggedBy, playerId),
          eq(matchParticipants.playerId, playerId),
        ),
      );
    if (referenced) throw new PlayerReferencedError(playerId);

    await tx.delete(players).where(eq(players.id, playerId));
  });
}

// ---- Admin roster view -----------------------------------------------------

export interface RosterEntry {
  id: string;
  name: string;
  status: PlayerStatus;
  /** Binding timestamps for the Joined rows (spec decision 53). */
  binding: { createdAt: Date; lastSeenAt: Date } | null;
  /** The Player's live Personal Link, if any — Admin re-copies this. */
  personalLink: { token: string; expiresAt: Date } | null;
  /** False when the match log references them (decision 31). */
  deletable: boolean;
}

/** The three groups of spec decision 50, each in roster order. */
export interface AdminRoster {
  joined: RosterEntry[];
  notJoined: RosterEntry[];
  retired: RosterEntry[];
}

export async function getAdminRoster(
  db: Db,
  now: Date = new Date(),
): Promise<AdminRoster> {
  const [roster, bindings, personalLinks, referenced] = await Promise.all([
    listPlayers(db),
    listActiveBindings(db),
    // All live Personal Links in one query — one per Player by construction
    // (the partial unique index), so a plain Map is safe.
    db
      .select()
      .from(onboardingInvitations)
      .where(
        and(
          eq(onboardingInvitations.kind, "personal"),
          isNull(onboardingInvitations.revokedAt),
          isNull(onboardingInvitations.consumedAt),
        ),
      ),
    referencedPlayerIds(db),
  ]);

  const bindingByPlayer = new Map(bindings.map((b) => [b.playerId, b]));
  const invitations = new Map(
    personalLinks.map((i) => [i.playerId as string, i]),
  );

  const entries = roster.map((player): RosterEntry => {
    const binding = bindingByPlayer.get(player.id) ?? null;
    const invitation = invitations.get(player.id) ?? null;
    return {
      id: player.id,
      name: player.name,
      status: playerStatus(player, binding !== null),
      binding: binding
        ? { createdAt: binding.createdAt, lastSeenAt: binding.lastSeenAt }
        : null,
      // Only a link that still works is worth offering to copy.
      personalLink:
        invitation && isInvitationValid(invitation, now)
          ? { token: invitation.token, expiresAt: invitation.expiresAt }
          : null,
      deletable: !referenced.has(player.id),
    };
  });

  return {
    joined: entries.filter((e) => e.status === "joined"),
    notJoined: entries.filter((e) => e.status === "not-joined"),
    retired: entries.filter((e) => e.status === "retired"),
  };
}

/** Whether this Player currently holds a Device Binding. */
export async function isJoined(db: Db, playerId: string): Promise<boolean> {
  return (await getActiveBinding(db, playerId)) !== null;
}
