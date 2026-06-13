# Notifications & Reminders

**Rank: 12 — Brings people back**

## What it is
Targeted pings that pull players back into the app at the moments that matter.

## Core capabilities
- Match result logged involving you → confirm prompt (see [09])
- You were invited to a match or tournament → RSVP prompt
- Rating milestones: overtaken on the leaderboard, new personal best, tier promotion
- Tournament round ready / your next opponent is known
- Per-user notification settings (people mute over-chatty apps fast)

## Ideas beyond the basics
- "You haven't played in 3 weeks — Jonas is catching up to your rating" (motivating, slightly evil)
- Weekly group digest: matches played, biggest upset, leaderboard movement
- Smart timing: remind about result entry shortly after a scheduled match's end time

## Why this rank
Pure retention infrastructure. The app works without it, but engagement roughly doubles with it. Ranked here because it amplifies other features rather than standing alone.

## Resolved decisions (self-grill, 2026-06-12)

**Q: What's the event catalogue?** Confirm prompt, match/tournament invite, overtaken on the leaderboard, personal-best rating, tier promotion (once tiers exist), tournament round ready, season ended. Per-user toggles by category, all defaulting on *except* the competitive-pressure ones (overtaken) which default on but are the first thing the settings screen shows.

**Q: Delivery channel?** *Answered 2026-06-12:* v1 is a mobile-optimized web app, so the **in-app inbox is the v1 channel**, shipping with the first notification-producing feature (confirmation prompts, Milestone 2), backed by email for the few critical prompts (confirmations, invites). **Web push arrives with the v2 PWA upgrade** ([ADR-0010](../docs/adr/0010-stack-and-platform.md)). The event catalogue is channel-agnostic, so nothing else here changes.

**Q: The "slightly evil" nudge ("Jonas is catching up")?** Opt-in, default **off**. It's funny exactly once per person; uninvited it's the kind of thing that gets the whole app muted. Respect by default, mischief by consent.

**Q: Weekly group digest?** Yes, but Milestone 4 — it needs a few features' worth of content (feed, stats, movement) to not feel empty.

**Q: Smart timing for result entry?** With scheduling (08): prompt shortly after a Scheduled Match's end time. Until then, the confirm-prompt flow covers the need.

**Scope: Milestone 3** for push + catalogue (in-app inbox earlier, with Milestone 2's confirmation prompts).
