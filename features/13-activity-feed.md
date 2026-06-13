# Activity Feed

**Rank: 13 — The group's living room**

## What it is
A chronological feed per group showing everything that happens: match results, rating swings, streaks, tournament outcomes. Makes the app feel social even when you're not playing.

## Core capabilities
- Feed entries for: matches played (with score and Elo changes), tournaments finished, milestones reached, new members joined
- Reactions on feed items (🔥 😂 💀) — minimal but enough for banter
- Highlight notable events automatically: upsets, streak breaks, leaderboard takeovers

## Ideas beyond the basics
- Comments on matches for trash talk (keep it simple — the group chat exists, don't rebuild WhatsApp)
- "Match of the week" auto-pick: closest score or biggest upset
- Shareable result cards (image with score + Elo change) to post into the actual group chat

## Why this rank
Strong glue for engagement, but everything in it is derived from other features. It can be added at any point and immediately works on historical data.

## Resolved decisions (self-grill, 2026-06-12)

**Q: What produces feed entries?** Confirmed competitive matches (score + rating deltas), casual matches (compact, labelled), tournament completions, season events, milestones (streaks, personal bests, badges later), members joining. Auto-highlights: upsets (winner had <30% pre-match win probability), streak breaks, leaderboard takeovers — all computable from data we already have.

**Q: Reactions?** A fixed set of five (🔥 😂 💀 👑 🥲), no custom emoji, no threads. Enough for banter, nothing to moderate.

**Q: Comments?** **No.** The group chat exists; rebuilding a worse WhatsApp inside the app is the classic scope trap. Revisit only if users genuinely ask.

**Q: Share cards — how important?** Promoted to the **headline of this feature**: an auto-generated result image (players, score, rating changes) shareable straight into the actual group chat. It's the app's growth and retention bridge in one — the same coexist-with-WhatsApp strategy as scheduling (08). Match of the week auto-pick (closest score or biggest upset) becomes a weekly share card.

**Scope: Milestone 2** for the basic feed (it makes the app feel alive the week stats land); share cards in **Milestone 3** alongside tournaments and seasons, which produce the most shareable moments.
