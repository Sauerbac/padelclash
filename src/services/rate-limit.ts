/**
 * Rate limiting for the endpoints an outsider can reach (spec decision 55).
 *
 * Deliberately a per-process sliding window in memory, not a table: the app is
 * one long-lived container on Coolify, and the job here is to stop scripted
 * abuse — guessing invitation tokens, grinding the Admin password, flooding the
 * match log. It is explicitly *not* an approval system; a human holding the
 * General Link during an onboarding evening never hits these numbers.
 */

export interface RateLimitDecision {
  allowed: boolean;
  /** Milliseconds until the caller's next attempt could succeed. */
  retryAfterMs: number;
}

export interface RateLimitOptions {
  /** Attempts allowed inside the window. */
  limit: number;
  windowMs: number;
}

export interface RateLimiter {
  check(key: string, now?: Date): RateLimitDecision;
  reset(): void;
}

/**
 * A sliding window: each key keeps the timestamps of its recent attempts and
 * anything older than the window falls off. Precise near the boundary, which a
 * fixed window is not, and the bookkeeping is trivial at this volume.
 */
export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const attempts = new Map<string, number[]>();
  // Bound the map: keys are IPs, so an attacker rotating them shouldn't grow
  // it without limit. Swept whenever it gets large rather than on a timer.
  const SWEEP_THRESHOLD = 10_000;

  function sweep(cutoff: number): void {
    for (const [key, times] of attempts) {
      const live = times.filter((t) => t > cutoff);
      if (live.length === 0) attempts.delete(key);
      else attempts.set(key, live);
    }
  }

  return {
    check(key: string, now: Date = new Date()): RateLimitDecision {
      const nowMs = now.getTime();
      const cutoff = nowMs - options.windowMs;

      if (attempts.size > SWEEP_THRESHOLD) sweep(cutoff);

      const recent = (attempts.get(key) ?? []).filter((t) => t > cutoff);

      if (recent.length >= options.limit) {
        // The oldest attempt in the window is the one whose expiry frees a slot.
        const retryAfterMs = recent[0] + options.windowMs - nowMs;
        attempts.set(key, recent);
        return { allowed: false, retryAfterMs };
      }

      recent.push(nowMs);
      attempts.set(key, recent);
      return { allowed: true, retryAfterMs: 0 };
    },

    reset(): void {
      attempts.clear();
    },
  };
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * Password guessing is the one thing here worth throttling hard — it's the
 * only endpoint where a secret is low-entropy enough to grind.
 */
export const adminLoginLimiter = createRateLimiter({
  limit: 10,
  windowMs: 15 * MINUTE,
});

/**
 * The visitor-facing onboarding surface: previewing and confirming a join.
 * Loose enough that a whole evening of onboarding never notices, tight enough
 * that scripted token guessing is pointless — against a 256-bit space it was
 * hopeless regardless.
 */
export const onboardingLimiter = createRateLimiter({
  limit: 30,
  windowMs: HOUR,
});

/**
 * Admin's own mutations — roster edits, link generation, revocation. Separate
 * from and looser than the visitor limiter: an Admin setting up an evening
 * legitimately issues a link per player back-to-back, and sharing the visitor
 * budget would throttle exactly the work the app exists to support. Still
 * capped, so a stolen Admin session can't be used to churn the roster.
 */
export const adminMutationLimiter = createRateLimiter({
  limit: 200,
  windowMs: HOUR,
});

/** Logging, editing and deleting matches, including offline-queue catch-up. */
export const matchMutationLimiter = createRateLimiter({
  limit: 60,
  windowMs: 5 * MINUTE,
});
