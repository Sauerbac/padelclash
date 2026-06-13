# Result Confirmation & Dispute Handling

**Rank: 9 — Keeps the Elo trustworthy**

## What it is
A lightweight integrity layer: when one player logs a match, the others involved can confirm or contest it before it permanently affects ratings.

## Core capabilities
- After a match is logged, the other participants get a confirmation prompt
- Auto-confirm after a timeout (e.g. 48h) so lazy friends don't block the system
- Contest flow: flag a wrong score, logger can correct it, group admin resolves stalemates
- Audit trail: who logged, who edited, what changed

## Ideas beyond the basics
- "Casual" matches (see [02]) skip confirmation entirely — only Elo-relevant matches need it
- Trust mode per group: small friend groups can disable confirmation altogether
- Retroactive correction recomputes affected Elo changes

## Why this rank
Among friends outright cheating is rare, but typos and "that was 6-4 not 6-3" disputes are guaranteed. Without a correction mechanism, every error permanently poisons the ratings — and people care about their rating.

## Resolved decisions (self-grill, 2026-06-12)

**Q: Does the rating wait for confirmation?** **No — it applies immediately**, with the match marked Pending. The post-match dopamine ("+14!") is the product's heartbeat; delaying it 48 hours for a lazy friend's tap would kill the core loop. Corrections are safe because replay ([ADR-0001](../docs/adr/0001-ratings-derived-by-replay.md)) recomputes everything downstream anyway. Confirmation is a correction window, not a gate.

**Q: Who has to confirm?** **Any one player from the opposing side** — the logger's side is implicitly confirming by logging. Requiring all participants quadruples the nagging for zero integrity gain among friends.

**Q: What if the entire opposing side is unclaimed?** Auto-confirm immediately — there is nobody to wait for ([ADR-0004](../docs/adr/0004-guests-are-unclaimed-players.md)). The founder bootstrapping historical matches therefore never fights confirmation prompts.

**Q: Timeout?** Auto-confirm after **48h**. Long enough to catch "that was 6-4 not 6-3", short enough that the leaderboard isn't haunted by pending ghosts.

**Q: Contest flow?** Contest = flag + short note → match stays Pending and the logger can correct (which restarts confirmation) → if they deadlock, any admin sets the final result. Full audit trail (who logged, edited, contested, resolved) from day one — it's cheap now and impossible to retrofit.

**Q: What skips confirmation?** Casual matches (no stakes) and tournament matches (everyone is present, see 06). **Trust Mode** turns it off group-wide — likely the right setting for a 6-person friend group, but **default is on**, because trust is easy to grant and awkward to revoke after the first dispute.

## Replay-stream contract (architecture grill, 2026-06-13)

Two orthogonal axes decide whether a match moves ratings:

- **Classification — Competitive vs Casual.** Casual matches are *never* in the replay stream ([ADR-0001](../docs/adr/0001-ratings-derived-by-replay.md)); they are logged for the record and skipped entirely.
- **Integrity status — Pending / Confirmed / Contested / Voided.** Pending, Confirmed, and **Contested all stay in the stream** (the optimistic model: a contest does not suspend a result; the leaderboard reflects the logged result until an Admin resolves it). Only **Voided** leaves the stream — a void is a **soft delete**, the row is retained in the log for audit but replay skips it.

So the replay stream = **every Competitive, non-Voided match in the group, ordered by `(played-at, logged-at, id)`, regardless of confirmation status.** A contest changes nothing in the stream; the Admin's resolution (an edit, or a void) is the replay trigger, per ADR-0001. Rejected: pulling contested matches from the stream on objection — it lets one objector rewrite the leaderboard before any Admin looks, and a stalled contest leaves ratings wrong indefinitely.

**Scope: Milestone 2** — first thing after the MVP loop, before tournaments raise the stakes.
