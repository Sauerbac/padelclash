import type { Db } from "./db";
import type { OnboardingInvitation } from "./db/schema";
import { invitationState, isInvitationValid } from "../domain/onboarding";
import {
  consumeInvitation,
  createBinding,
  getActiveBinding,
  getActiveGeneralInvitation,
  getActivePersonalInvitation,
  issueInvitation,
  findInvitationByToken,
  lockOnboarding,
  resolveCredential,
  revokeActiveBinding,
  revokeGeneralInvitation,
  revokePersonalInvitation,
} from "./access";
import {
  createPlayer,
  getPlayerById,
  listNotJoinedPlayers,
} from "./players";
import { PlayerNameError, PlayerNotFoundError } from "./errors";

/**
 * The onboarding flows of spec decisions 29–46: Admin's link controls, the
 * non-mutating preview a visitor sees, and the one transaction that turns an
 * invitation into a Device Binding.
 *
 * Everything a visitor can trigger returns a result union rather than
 * throwing. "The Player you picked was claimed while you were reading the
 * screen" is an ordinary outcome of a shared link, not an exception, and the
 * frontend has to render each case differently.
 */

// ---- Admin: the General Onboarding Link ------------------------------------

export interface LinkDetails {
  token: string;
  expiresAt: Date;
}

export type GeneralLinkResult =
  | { ok: true; link: LinkDetails }
  | { ok: false; error: "already-active" };

/**
 * Issue the circle's General Link. Refuses while one is still valid — Admin
 * copies that one instead (decision 36). An expired predecessor is revoked
 * here rather than left lying around, which is also what keeps the partial
 * unique index satisfiable.
 */
export async function generateGeneralLink(
  db: Db,
  now: Date = new Date(),
): Promise<GeneralLinkResult> {
  return db.transaction(async (tx) => {
    await lockOnboarding(tx);

    const existing = await getActiveGeneralInvitation(tx);
    if (existing) {
      if (isInvitationValid(existing, now)) {
        return { ok: false, error: "already-active" };
      }
      await revokeGeneralInvitation(tx, now);
    }

    const { token, invitation } = await issueInvitation(tx, {
      kind: "general",
      now,
    });
    return { ok: true, link: { token, expiresAt: invitation.expiresAt } };
  });
}

/**
 * Takes the onboarding lock like confirmation does. Without it a confirmation
 * that had already re-read the invitation could still commit a binding *after*
 * Admin revoked — "immediate" revocation (decision 45) that isn't. With the
 * lock the two are strictly ordered: either the join completes and the revoke
 * applies to a spent link, or the revoke lands first and the join fails.
 */
export async function revokeGeneralLink(
  db: Db,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockOnboarding(tx);
    await revokeGeneralInvitation(tx, now);
  });
}

/** The live General Link for Admin to copy, or null when there isn't one. */
export async function getGeneralLink(
  db: Db,
  now: Date = new Date(),
): Promise<LinkDetails | null> {
  const invitation = await getActiveGeneralInvitation(db);
  if (!invitation || !isInvitationValid(invitation, now)) return null;
  return { token: invitation.token, expiresAt: invitation.expiresAt };
}

// ---- Admin: Personal Onboarding Links --------------------------------------

/**
 * Issue a Player's Personal Link, replacing whichever one they had (decision
 * 40). This is also the "Replace device" action: the current binding is left
 * untouched and only falls when the new link is actually used (decision 45),
 * so an Admin who mis-clicks hasn't locked anyone out.
 */
export async function generatePersonalLink(
  db: Db,
  playerId: string,
  now: Date = new Date(),
): Promise<LinkDetails> {
  return db.transaction(async (tx) => {
    await lockOnboarding(tx);

    const player = await getPlayerById(tx, playerId);
    if (!player) throw new PlayerNotFoundError(playerId);
    // A Retired Player cannot join, so an invitation for them would be a
    // link that is dead on arrival (decision 35).
    if (player.retiredAt) {
      throw new PlayerNotFoundError(playerId);
    }

    await revokePersonalInvitation(tx, playerId, now);
    const { token, invitation } = await issueInvitation(tx, {
      kind: "personal",
      playerId,
      now,
    });
    return { token, expiresAt: invitation.expiresAt };
  });
}

/** The Player's live Personal Link for Admin to re-copy, if it still works. */
export async function getPersonalLink(
  db: Db,
  playerId: string,
  now: Date = new Date(),
): Promise<LinkDetails | null> {
  const invitation = await getActivePersonalInvitation(db, playerId);
  if (!invitation || !isInvitationValid(invitation, now)) return null;
  return { token: invitation.token, expiresAt: invitation.expiresAt };
}

/** Serialized against confirmation for the same reason as revokeGeneralLink. */
export async function revokePersonalLink(
  db: Db,
  playerId: string,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockOnboarding(tx);
    await revokePersonalInvitation(tx, playerId, now);
  });
}

// ---- Admin: emergency revocation -------------------------------------------

/**
 * "Revoke access" (decisions 45 and 46): drop the Player's binding and their
 * outstanding Personal Link, *and* the circle's General Link. That last part
 * is the point — without it, whoever just lost access could walk straight back
 * in through a General Link already sitting in the group chat.
 */
export async function revokeAccess(
  db: Db,
  playerId: string,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockOnboarding(tx);

    const player = await getPlayerById(tx, playerId);
    if (!player) throw new PlayerNotFoundError(playerId);

    await revokeActiveBinding(tx, playerId, now);
    await revokePersonalInvitation(tx, playerId, now);
    await revokeGeneralInvitation(tx, now);
  });
}

// ---- Visitor: preview (never mutates) --------------------------------------

/** Why a link didn't work. Mirrors InvitationState minus its "valid" case. */
export type InvitationProblem =
  | "not-found"
  | "revoked"
  | "consumed"
  | "expired"
  | "player-unavailable";

export interface PersonalPreview {
  kind: "personal";
  player: { id: string; name: string };
  /** True when confirming replaces a binding the Player already holds. */
  replacesBinding: boolean;
}

export interface GeneralPreview {
  kind: "general";
  /** The only Players this link may join as (decision 29). */
  notJoined: { id: string; name: string }[];
}

export type InvitationPreview = PersonalPreview | GeneralPreview;

export type PreviewResult =
  | { ok: true; preview: InvitationPreview }
  | { ok: false; error: InvitationProblem };

/**
 * What a visitor sees before committing. Reads only: opening or refreshing a
 * link must never consume it or change a binding (decisions 42 and 43).
 */
export async function previewInvitation(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<PreviewResult> {
  const invitation = await findInvitationByToken(db, token);
  if (!invitation) return { ok: false, error: "not-found" };

  const state = invitationState(invitation, now);
  if (state !== "valid") return { ok: false, error: state };

  if (invitation.kind === "general") {
    const notJoined = await listNotJoinedPlayers(db);
    return {
      ok: true,
      preview: {
        kind: "general",
        notJoined: notJoined.map((p) => ({ id: p.id, name: p.name })),
      },
    };
  }

  const player = await getPlayerById(db, invitation.playerId!);
  if (!player || player.retiredAt) {
    return { ok: false, error: "player-unavailable" };
  }
  return {
    ok: true,
    preview: {
      kind: "personal",
      player: { id: player.id, name: player.name },
      replacesBinding: (await getActiveBinding(db, player.id)) !== null,
    },
  };
}

// ---- Visitor: confirmation (the atomic one) --------------------------------

/** What the visitor confirmed. The token alone decides which are legal. */
export type JoinRequest =
  | { via: "personal"; token: string }
  | { via: "general-existing"; token: string; playerId: string }
  | { via: "general-new"; token: string; name: string };

export type JoinProblem =
  | InvitationProblem
  | "wrong-link-kind"
  | "player-already-joined"
  | "already-bound"
  | "name-blank"
  | "name-too-long"
  | "name-taken";

export type JoinResult =
  | {
      ok: true;
      playerId: string;
      playerName: string;
      /** Plaintext credential for the caller's cookie; never stored. */
      credential: string;
    }
  | { ok: false; error: JoinProblem };

/**
 * Turn a confirmed invitation into a Device Binding — the atomic commit of
 * decision 51. Link validity, installation state, Player availability, name
 * uniqueness, invitation consumption and binding replacement all land in one
 * transaction, so a race either produces a complete join or nothing at all:
 * never a Player row without a binding, and never two Players sharing a name.
 *
 * `presentedCredential` is whatever binding cookie the caller arrived with.
 * It is re-resolved inside the transaction so that decision 38 — a bound
 * installation cannot switch Players — is enforced atomically with the write,
 * not merely checked beforehand by the action layer.
 *
 * Residual, and deliberately so: two confirmations from the *same* unbound
 * browser, each selecting a different Player through one General Link, can
 * both legitimately succeed — an unbound installation presents nothing for the
 * server to serialize on, so there is no identity to collide. Only one
 * credential survives in the cookie; the other Player shows as Joined and
 * Admin clears it with "Revoke access". The client keeps this to a theoretical
 * case by disabling the confirm button while the request is in flight.
 */
export async function confirmJoin(
  db: Db,
  request: JoinRequest,
  now: Date = new Date(),
  presentedCredential: string | null = null,
): Promise<JoinResult> {
  return db.transaction(async (tx): Promise<JoinResult> => {
    // One lock for the whole flow. Onboarding is rare enough that serializing
    // it beats reasoning about interleaved row locks (see lockOnboarding).
    await lockOnboarding(tx);

    // Decision 38, inside the transaction: if this installation still holds a
    // live binding, it may not switch Players, and the invitation stays unspent.
    if (
      presentedCredential &&
      (await resolveCredential(tx, presentedCredential))
    ) {
      return { ok: false, error: "already-bound" };
    }

    // Re-read the invitation *inside* the transaction: the preview the visitor
    // is looking at may be minutes stale, and Admin may have revoked it since.
    const invitation = await findInvitationByToken(tx, request.token);
    if (!invitation) return { ok: false, error: "not-found" };

    const state = invitationState(invitation, now);
    if (state !== "valid") return { ok: false, error: state };

    if (!linkKindAllows(invitation, request)) {
      return { ok: false, error: "wrong-link-kind" };
    }

    const target = await resolveTarget(tx, invitation, request);
    if (!target.ok) return target;

    const { playerId, playerName } = target;

    // Replaces the existing binding when this is a device replacement; the old
    // credential stays live right up to this statement (decision 32).
    const { credential } = await createBinding(tx, playerId, {
      now,
      viaInvitationId: invitation.id,
    });

    // Whichever route joins first wins, and kills the other invitation
    // (decision 44) — including a General-Link join retiring the Player's
    // outstanding Personal Link.
    await revokePersonalInvitation(tx, playerId, now, {
      exceptId: invitation.id,
    });
    if (invitation.kind === "personal") {
      await consumeInvitation(tx, invitation.id, now);
    }

    return { ok: true, playerId, playerName, credential };
  });
}

function linkKindAllows(
  invitation: OnboardingInvitation,
  request: JoinRequest,
): boolean {
  return request.via === "personal"
    ? invitation.kind === "personal"
    : invitation.kind === "general";
}

type TargetResult =
  | { ok: true; playerId: string; playerName: string }
  | { ok: false; error: JoinProblem };

/** Which Player this join lands on — selected, created, or the link's own. */
async function resolveTarget(
  tx: Db,
  invitation: OnboardingInvitation,
  request: JoinRequest,
): Promise<TargetResult> {
  if (request.via === "general-new") {
    try {
      const player = await createPlayer(tx, request.name);
      return { ok: true, playerId: player.id, playerName: player.name };
    } catch (err) {
      if (err instanceof PlayerNameError) {
        return { ok: false, error: nameProblem(err) };
      }
      throw err;
    }
  }

  const playerId =
    request.via === "personal" ? invitation.playerId! : request.playerId;
  const player = await getPlayerById(tx, playerId);
  if (!player || player.retiredAt) {
    return { ok: false, error: "player-unavailable" };
  }

  // A General Link may only join a Not Joined Player (decision 29). A Personal
  // Link deliberately may replace its own Player's binding (decision 32).
  if (request.via === "general-existing") {
    if (await getActiveBinding(tx, playerId)) {
      return { ok: false, error: "player-already-joined" };
    }
  }

  return { ok: true, playerId: player.id, playerName: player.name };
}

function nameProblem(err: PlayerNameError): JoinProblem {
  return err.problem === "blank"
    ? "name-blank"
    : err.problem === "too-long"
      ? "name-too-long"
      : "name-taken";
}
