# Data model — design reference

The core relational schema, from Session B of the architecture grilling (2026-06-13). Pairs with [the rating-engine reference](./rating-engine.md) (which covers the derived projection tables). The *why* lives in the ADRs; this is the *shape*.

## Identity — Player is the anchor

[ADR-0004](../adr/0004-guests-are-unclaimed-players.md) (schema realization section) is authoritative.

- **`player`** — the domain entity every match, rating and membership references. No auth columns. Fields: `id` (UUIDv7), `display_name`, `avatar`, `preferred_side` (left/right), `handedness`, `bio` (~80 chars). An **Unclaimed Player is a `player` row no auth user references yet.**
- **Account = Better Auth's `user` table**, extended with `player_id` (**unique, not-null**). Better Auth owns its own `user` / `session` / `account` (OAuth) tables; we add the one FK. Auth scope: email+password with verification, plus Google sign-in (feature 01).
- **Claiming**: create a fresh auth user, point its `player_id` at the existing unclaimed `player`. No data move → no replay. Bearer-link token: single-use, hashed at rest, ~30-day expiry, revocable; 7-day Admin detach window as the mis-claim safety net (feature 01). A claim link opened by someone who is already a Player is refused in v1 (merge is v1.2).

## Groups & membership

- **`group`** — `id`, `name`, settings (trust mode on/off default on, season config, ranked threshold default 3). Settings drive engine/policy behavior.
- **`membership`** — `(group_id, player_id)` join; `role` (`admin`/`member`), `status` (`active`/`former`), `joined_at`. **Unclaimed Players have membership rows** (they reference `player_id`, never the account). A **Former Member** keeps its row at `status=former` — history stays in the group's record, they leave the active leaderboard. Founder is first admin; last admin must hand over before leaving — enforced in the domain layer (feature 04).

## Matches — source of truth

[ADR-0001](../adr/0001-ratings-derived-by-replay.md), [ADR-0002](../adr/0002-ratings-are-per-group.md), [ADR-0003](../adr/0003-one-match-model-three-result-formats.md).

- **`match`** — `id` (UUIDv7), `group_id` (not null), `played_at` (timestamp, editable), `logged_at` (immutable), `logged_by` (Logger), `classification` (`competitive`/`casual`), `status` (`pending`/`confirmed`/`contested`/`voided`), `result_format` (`set`/`points`/`simple`), `result` (jsonb, shape pinned by a discriminated union in the domain core), `winner_side` (`A`/`B`).
- **`match_participant`** — `(match_id, player_id, side)`, `side ∈ {A,B}`; one or two rows per side covers singles and doubles uniformly. The engine's input: group by side → mean rating → apply delta. **Source data; stays separate from the `rating_history` projection** even though both key on `(match_id, player_id)` (ADR-0007: source ≠ projection).

## Derived — not stored as base tables

- **Ratings, rating history, leaderboard** → projection tables in [the engine reference](./rating-engine.md), rebuilt by replay.
- **Pairing** → *derived*, not a table: a canonical unordered player-pair key over `match_participant`; chemistry is a projection grouped by that key. Revisit only if Pairings ever need their own identity (names/vanity) — CONTEXT's definition is purely statistical, so derived for v1.
- **Streak, form, head-to-head** → projections over the match log (Session A).

## The replay stream (recap)

Engine input for a group = every **Competitive, non-Voided** match, ordered by `(played-at, logged-at, id)`, regardless of confirmation status (feature 09).
