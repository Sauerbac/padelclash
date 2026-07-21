// Onboarding Invitation lifetimes and validity — the framework-free half of
// the rules in spec decisions 29, 32, 36, 40 and 44. Persistence and the atomic
// confirmation transaction live in src/services/onboarding.ts.

/** Personal Onboarding Link lifetime (spec decision 32). */
export const PERSONAL_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** General Onboarding Link lifetime (spec decision 29). */
export const GENERAL_LINK_TTL_MS = 12 * 60 * 60 * 1000;

export type InvitationKind = "personal" | "general";

/** The lifecycle columns of an invitation row — all this module needs. */
export interface InvitationLifecycle {
  expiresAt: Date;
  /** Set when Admin (or a competing join) killed it early. */
  revokedAt: Date | null;
  /** Set when a successful join used it up. General links are never consumed. */
  consumedAt: Date | null;
}

export type InvitationState = "valid" | "revoked" | "consumed" | "expired";

/**
 * Why a link does or doesn't work, checked in the order the visitor should be
 * told about: a revoked link is revoked even if it also happens to have expired.
 */
export function invitationState(
  invitation: InvitationLifecycle,
  now: Date,
): InvitationState {
  if (invitation.revokedAt !== null) return "revoked";
  if (invitation.consumedAt !== null) return "consumed";
  if (invitation.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

export function isInvitationValid(
  invitation: InvitationLifecycle,
  now: Date,
): boolean {
  return invitationState(invitation, now) === "valid";
}

export function invitationExpiryFrom(kind: InvitationKind, now: Date): Date {
  const ttl = kind === "personal" ? PERSONAL_LINK_TTL_MS : GENERAL_LINK_TTL_MS;
  return new Date(now.getTime() + ttl);
}

/**
 * How Admin groups the roster (spec decision 50). "Joined" means a non-retired
 * Player holding an active Device Binding; retirement outranks both.
 */
export type PlayerStatus = "joined" | "not-joined" | "retired";

export function playerStatus(
  player: { retiredAt: Date | null },
  hasActiveBinding: boolean,
): PlayerStatus {
  if (player.retiredAt !== null) return "retired";
  return hasActiveBinding ? "joined" : "not-joined";
}
