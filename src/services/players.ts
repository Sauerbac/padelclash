import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "./db";
import { players, type Player } from "./db/schema";

// 128 bits, URL-safe — the token is the whole secret of a /join/<token> link.
function generatePersonalToken(): string {
  return randomBytes(16).toString("base64url");
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Player name must not be blank");
  return trimmed;
}

async function updatePlayer(
  db: Db,
  playerId: string,
  patch: Partial<typeof players.$inferInsert>,
): Promise<Player> {
  const [player] = await db
    .update(players)
    .set(patch)
    .where(eq(players.id, playerId))
    .returning();
  if (!player) throw new Error(`Player not found: ${playerId}`);
  return player;
}

export async function createPlayer(db: Db, name: string): Promise<Player> {
  const [player] = await db
    .insert(players)
    .values({ name: normalizeName(name), personalToken: generatePersonalToken() })
    .returning();
  return player;
}

export async function renamePlayer(
  db: Db,
  playerId: string,
  name: string,
): Promise<Player> {
  return updatePlayer(db, playerId, { name: normalizeName(name) });
}

export async function listPlayers(db: Db): Promise<Player[]> {
  return db.select().from(players).orderBy(asc(players.createdAt));
}

// Active = not retired; what pickers (name picker, match form) show.
export async function listActivePlayers(db: Db): Promise<Player[]> {
  return db
    .select()
    .from(players)
    .where(isNull(players.retiredAt))
    .orderBy(asc(players.createdAt));
}

export async function retirePlayer(db: Db, playerId: string): Promise<Player> {
  return updatePlayer(db, playerId, { retiredAt: new Date() });
}

export async function rotatePersonalToken(
  db: Db,
  playerId: string,
): Promise<Player> {
  return updatePlayer(db, playerId, { personalToken: generatePersonalToken() });
}

export async function getPlayerById(
  db: Db,
  playerId: string,
): Promise<Player | null> {
  // The id may come from a cookie; an arbitrary string would make pg throw
  // on the uuid cast, so pre-validate instead.
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(playerId)) return null;
  const [player] = await db.select().from(players).where(eq(players.id, playerId));
  return player ?? null;
}

export async function getPlayerByToken(
  db: Db,
  token: string,
): Promise<Player | null> {
  // Retired players' links stop binding — retirement revokes the invite.
  const [player] = await db
    .select()
    .from(players)
    .where(and(eq(players.personalToken, token), isNull(players.retiredAt)));
  return player ?? null;
}
