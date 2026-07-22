/**
 * What the offline queue does with a server refusal (spec decisions 26 and 52).
 *
 * This is the rule the sync loop got wrong in its first form, where every
 * non-ok result was treated the same way. The distinctions matter in opposite
 * directions, and both directions lose data or trust:
 *
 * - Retrying a refusal that can never succeed burns the shared match-mutation
 *   rate limit that the *rest* of the backlog needs, so one permanently stuck
 *   match can stall matches that would have synced fine.
 * - Discarding — or inviting the user to discard — a refusal that would have
 *   resolved itself throws away a real match over a passing outage.
 *
 * Framework-free on purpose: this is the interesting part of offline sync, and
 * it should be testable without IndexedDB, React, or a server. It covers only
 * refusals — an accepted write clears the item and a thrown call means "still
 * offline, change nothing", and neither needs a policy to decide.
 */

/** Why a match write was refused. Mirrored by MatchMutationError. */
export type MatchSyncRefusal =
  | "not-bound"
  | "identity-mismatch"
  | "not-allowed"
  | "rate-limited"
  | "invalid";

export interface RefusalHandling {
  /**
   * Abandon the rest of this pass. True when the reason condemns the whole
   * backlog rather than this one match — continuing would stamp an identical
   * error on every card and spend the budget proving it.
   */
  stopBatch: boolean;
  /**
   * The server's answer cannot change from this device, so the match stops
   * being retried and the user is offered the explicit Discard of decision 26.
   */
  permanent: boolean;
}

/**
 * `permanent: true` is what earns a match the Discard affordance. It means the
 * server's answer cannot change from this device:
 *
 * - `identity-mismatch` — the match belongs to a different Player than the one
 *   now bound here. Re-attributing it to the current Player is exactly what
 *   decision 52 forbids, so there is no version of retrying that helps.
 * - `invalid` / `not-allowed` — the payload will be rejected the same way for
 *   as long as it exists.
 *
 * `not-bound` is deliberately *not* permanent, which is the subtle one: an
 * installation that lost its binding may be re-invited as the same Player, and
 * then the backlog is legitimately syncable again. Marking it permanent would
 * push the user to delete matches that a new invite would have rescued.
 */
export function handleRefusal(code: MatchSyncRefusal): RefusalHandling {
  switch (code) {
    case "identity-mismatch":
    case "invalid":
    case "not-allowed":
      return { stopBatch: false, permanent: true };
    case "not-bound":
    case "rate-limited":
      return { stopBatch: true, permanent: false };
  }
}

/** Whether a recorded refusal is one the user must resolve by discarding. */
export function isPermanentRefusal(code: MatchSyncRefusal | undefined): boolean {
  return code !== undefined && handleRefusal(code).permanent;
}
