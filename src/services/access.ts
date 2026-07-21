import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "./db";
import {
  deviceBindings,
  onboardingInvitations,
  players,
  type DeviceBinding,
  type OnboardingInvitation,
  type Player,
} from "./db/schema";
import { generateToken, hashToken } from "./auth/credentials";
import { invitationExpiryFrom, type InvitationKind } from "../domain/onboarding";

/**
 * Row-level operations on the two access artifacts — Device Bindings and
 * Onboarding Invitations. Nothing here opens a transaction: every function
 * takes a `Db` (which a transaction handle satisfies) so the roster and
 * onboarding services can compose them into the atomic flows decision 51
 * demands. "Active" here means not revoked (and, for invitations, not
 * consumed); expiry is time-dependent and belongs to domain/onboarding.ts.
 */

// ---- Device Bindings -------------------------------------------------------

/** A freshly minted credential: the plaintext exists only in this return value. */
export interface IssuedBinding {
  /** Goes into the holder's cookie and is then unrecoverable. */
  credential: string;
  binding: DeviceBinding;
}

/**
 * Mint a binding for a Player, revoking whichever one they held. The revoke is
 * what makes the "replace device" path atomic: the old credential stays live
 * until this runs, and the partial unique index guarantees the two can never
 * overlap.
 */
export async function createBinding(
  db: Db,
  playerId: string,
  options: { now: Date; viaInvitationId?: string | null },
): Promise<IssuedBinding> {
  await revokeActiveBinding(db, playerId, options.now);

  const credential = generateToken();
  const [binding] = await db
    .insert(deviceBindings)
    .values({
      playerId,
      tokenHash: hashToken(credential),
      createdViaInvitationId: options.viaInvitationId ?? null,
      createdAt: options.now,
      lastSeenAt: options.now,
    })
    .returning();

  return { credential, binding };
}

/** The Player behind a credential, or null if it buys nothing (any more). */
export async function resolveCredential(
  db: Db,
  credential: string,
): Promise<{ player: Player; binding: DeviceBinding } | null> {
  const [row] = await db
    .select({ player: players, binding: deviceBindings })
    .from(deviceBindings)
    .innerJoin(players, eq(deviceBindings.playerId, players.id))
    .where(
      and(
        eq(deviceBindings.tokenHash, hashToken(credential)),
        isNull(deviceBindings.revokedAt),
        // Retirement ends access without a separate revoke step
        // (spec decision 34).
        isNull(players.retiredAt),
      ),
    );
  return row ?? null;
}

export async function getActiveBinding(
  db: Db,
  playerId: string,
): Promise<DeviceBinding | null> {
  const [binding] = await db
    .select()
    .from(deviceBindings)
    .where(
      and(
        eq(deviceBindings.playerId, playerId),
        isNull(deviceBindings.revokedAt),
      ),
    );
  return binding ?? null;
}

/** Every Player currently holding a binding — the "Joined" set. */
export async function listActiveBindings(db: Db): Promise<DeviceBinding[]> {
  return db
    .select()
    .from(deviceBindings)
    .where(isNull(deviceBindings.revokedAt));
}

/**
 * Every binding this Player has ever held, newest first — the troubleshooting
 * trail decision 53 promises. Retaining revoked rows is only half of that
 * promise; this is the half that makes them readable. Never exposes a hash.
 */
export async function listBindingHistory(
  db: Db,
  playerId: string,
): Promise<BindingRecord[]> {
  const rows = await db
    .select()
    .from(deviceBindings)
    .where(eq(deviceBindings.playerId, playerId))
    .orderBy(desc(deviceBindings.createdAt));

  return rows.map((b) => ({
    id: b.id,
    createdAt: b.createdAt,
    lastSeenAt: b.lastSeenAt,
    revokedAt: b.revokedAt,
    active: b.revokedAt === null,
  }));
}

/** One entry in a Player's binding history. Deliberately hash-free. */
export interface BindingRecord {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  active: boolean;
}

export async function revokeActiveBinding(
  db: Db,
  playerId: string,
  now: Date,
): Promise<void> {
  await db
    .update(deviceBindings)
    .set({ revokedAt: now })
    .where(
      and(
        eq(deviceBindings.playerId, playerId),
        isNull(deviceBindings.revokedAt),
      ),
    );
}

/**
 * Record that a credential was seen (spec decision 53). Throttled: a page view
 * shouldn't cost a write, and Admin only needs "last seen" to the hour.
 */
const LAST_SEEN_RESOLUTION_MS = 60 * 60 * 1000;

export async function touchBinding(
  db: Db,
  binding: DeviceBinding,
  now: Date,
): Promise<void> {
  const staleness = now.getTime() - binding.lastSeenAt.getTime();
  if (staleness < LAST_SEEN_RESOLUTION_MS) return;
  await db
    .update(deviceBindings)
    .set({ lastSeenAt: now })
    .where(eq(deviceBindings.id, binding.id));
}

// ---- Onboarding Invitations ------------------------------------------------

export interface IssuedInvitation {
  /** The URL segment Admin shares; also stored, so it can be re-copied. */
  token: string;
  invitation: OnboardingInvitation;
}

export async function issueInvitation(
  db: Db,
  options: { kind: InvitationKind; playerId?: string | null; now: Date },
): Promise<IssuedInvitation> {
  const token = generateToken();
  const [invitation] = await db
    .insert(onboardingInvitations)
    .values({
      kind: options.kind,
      playerId: options.playerId ?? null,
      token,
      createdAt: options.now,
      expiresAt: invitationExpiryFrom(options.kind, options.now),
    })
    .returning();
  return { token, invitation };
}

/**
 * Look an invitation up by its token. Returns revoked/consumed/expired rows
 * too — the caller decides what to tell the visitor, which is why previewing a
 * dead link can explain *why* it's dead.
 */
export async function findInvitationByToken(
  db: Db,
  token: string,
): Promise<OnboardingInvitation | null> {
  const [invitation] = await db
    .select()
    .from(onboardingInvitations)
    .where(eq(onboardingInvitations.token, token));
  return invitation ?? null;
}

/** The Player's un-revoked, un-consumed Personal Link — may still be expired. */
export async function getActivePersonalInvitation(
  db: Db,
  playerId: string,
): Promise<OnboardingInvitation | null> {
  const [invitation] = await db
    .select()
    .from(onboardingInvitations)
    .where(
      and(
        eq(onboardingInvitations.kind, "personal"),
        eq(onboardingInvitations.playerId, playerId),
        isNull(onboardingInvitations.revokedAt),
        isNull(onboardingInvitations.consumedAt),
      ),
    );
  return invitation ?? null;
}

/** The circle's un-revoked General Link — may still be expired. */
export async function getActiveGeneralInvitation(
  db: Db,
): Promise<OnboardingInvitation | null> {
  const [invitation] = await db
    .select()
    .from(onboardingInvitations)
    .where(
      and(
        eq(onboardingInvitations.kind, "general"),
        isNull(onboardingInvitations.revokedAt),
      ),
    );
  return invitation ?? null;
}

/**
 * Kill the Player's outstanding Personal Link. `exceptId` spares the very link
 * a join is currently spending, so that one records `consumed_at` rather than
 * the misleading `revoked_at` (spec decision 44).
 */
export async function revokePersonalInvitation(
  db: Db,
  playerId: string,
  now: Date,
  options: { exceptId?: string } = {},
): Promise<void> {
  const conditions = [
    eq(onboardingInvitations.kind, "personal"),
    eq(onboardingInvitations.playerId, playerId),
    isNull(onboardingInvitations.revokedAt),
    isNull(onboardingInvitations.consumedAt),
  ];
  if (options.exceptId) {
    conditions.push(ne(onboardingInvitations.id, options.exceptId));
  }
  await db
    .update(onboardingInvitations)
    .set({ revokedAt: now })
    .where(and(...conditions));
}

export async function revokeGeneralInvitation(
  db: Db,
  now: Date,
): Promise<void> {
  await db
    .update(onboardingInvitations)
    .set({ revokedAt: now })
    .where(
      and(
        eq(onboardingInvitations.kind, "general"),
        isNull(onboardingInvitations.revokedAt),
      ),
    );
}

export async function consumeInvitation(
  db: Db,
  invitationId: string,
  now: Date,
): Promise<void> {
  await db
    .update(onboardingInvitations)
    .set({ consumedAt: now })
    .where(eq(onboardingInvitations.id, invitationId));
}

/**
 * Serializes onboarding confirmations against each other (spec decision 51).
 * Onboarding happens a handful of times an evening, so taking one lock for the
 * whole flow is cheaper to reason about than a lattice of row locks — and the
 * partial unique indexes still backstop it. Transaction-scoped: released on
 * commit or rollback, and it never blocks readers.
 */
const ONBOARDING_LOCK_KEY = 7_454_002;

export async function lockOnboarding(tx: Db): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${ONBOARDING_LOCK_KEY})`);
}
