import type { PlayerNameProblem } from "../domain/player-name";

// Typed failures the service layer throws for the handful of operations with a
// single expected way to fail. Flows with many expected outcomes — onboarding
// confirmation above all — return result unions instead, because there
// "the target Player was claimed while you were reading the screen" is an
// ordinary answer rather than an exception. Server actions translate both into
// the error codes in src/app/actions/.

export type NameProblem = PlayerNameProblem | "name-taken";

export class PlayerNameError extends Error {
  constructor(readonly problem: NameProblem) {
    super(
      {
        blank: "A Player Name can't be blank.",
        "too-long": "That Player Name is too long.",
        "name-taken": "Another Player already has that name.",
      }[problem],
    );
    this.name = "PlayerNameError";
  }
}

export class PlayerNotFoundError extends Error {
  constructor(readonly playerId: string) {
    super("That Player no longer exists.");
    this.name = "PlayerNotFoundError";
  }
}

/**
 * Thrown when Admin tries to delete a Player the match log still references
 * (spec decision 31). Deleting the referencing Matches lifts it.
 */
export class PlayerReferencedError extends Error {
  constructor(readonly playerId: string) {
    super(
      "That Player appears in the match log and can only be retired. " +
        "Delete the matches referencing them to make deletion possible.",
    );
    this.name = "PlayerReferencedError";
  }
}

/** Thrown when a caller lacks the binding or Admin session an operation needs. */
export class AccessDeniedError extends Error {
  constructor(
    readonly reason: "not-bound" | "admin-required",
    message: string,
  ) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

/** Postgres unique-violation — the race backstop behind every name check. */
const UNIQUE_VIOLATION = "23505";

interface PgError {
  code?: string;
  constraint?: string;
}

/**
 * Drizzle wraps driver errors in a DrizzleQueryError carrying the query text,
 * so the pg error with the actual SQLSTATE sits on `cause` — walk the chain
 * rather than reading the top-level object, which has no `code` at all.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  for (let current = err; current; current = (current as Error).cause) {
    const pgError = current as PgError;
    if (pgError.code === UNIQUE_VIOLATION) {
      return constraint === undefined || pgError.constraint === constraint;
    }
  }
  return false;
}
