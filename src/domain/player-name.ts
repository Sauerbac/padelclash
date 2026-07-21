// Player Name normalization (spec decision 54). Two values come out of one raw
// string: the `display` form the roster shows, and the `normalized` folding key
// the database constrains uniquely. Display casing is always preserved — only
// the key is folded.

/** Roster rows, not essays. */
export const MAX_PLAYER_NAME_LENGTH = 40;

export type PlayerNameProblem = "blank" | "too-long";

export interface PlayerName {
  /** What the roster shows — the author's casing, kept verbatim. */
  display: string;
  /** The case-folded uniqueness key `players.normalized_name` constrains. */
  normalized: string;
}

export type PlayerNameResult =
  | { ok: true; name: PlayerName }
  | { ok: false; problem: PlayerNameProblem };

// Zero-width and bidi formatting characters (ZWSP, ZWJ, RLM, BOM, ...). They
// are invisible in a roster row but enough to smuggle a second "Simon" past a
// uniqueness check, so they are removed outright rather than collapsed.
const FORMAT_CHARS = /\p{Cf}/gu;

// Everything else non-printable — the remaining control characters and every
// flavour of space — collapses to a single plain space.
const BLANKS = /[\p{Cc}\s]+/gu;

/**
 * Trim, collapse internal whitespace, Unicode compatibility-normalize (NFKC),
 * then case-fold for the key. NFKC is what makes the visually identical
 * fullwidth "Simon" and plain "Simon" collide rather than coexist.
 */
export function normalizePlayerName(raw: string): PlayerNameResult {
  const display = raw
    .normalize("NFKC")
    .replace(FORMAT_CHARS, "")
    .replace(BLANKS, " ")
    .trim();

  if (display.length === 0) return { ok: false, problem: "blank" };
  if (display.length > MAX_PLAYER_NAME_LENGTH) {
    return { ok: false, problem: "too-long" };
  }

  return { ok: true, name: { display, normalized: display.toLowerCase() } };
}
