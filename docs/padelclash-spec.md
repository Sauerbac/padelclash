# PadelClash — design and functionality specification

PadelClash is a padel Match tracker for one private circle: log Matches, follow the Feed, and watch the Rating-based Leaderboard move. It is installable as a PWA on iOS and Android.

This index and the linked topic files are the source of truth. All decisions predating the original specification are void unless restated in this specification. Each numbered decision has exactly one topical home. Both the main topic sections and their decision histories are normative; when they conflict, the higher-numbered decision is the later rule.

## Reading guide

Always read this index, then only the topic files relevant to the task. Read multiple topics when a change crosses their boundaries. Read the complete specification only for genuinely cross-cutting work.

| Topic | Read when working on |
|---|---|
| [Product scope](./spec/product.md) | Product boundaries, exclusions, or future ideas |
| [Domain and matches](./spec/domain.md) | Players, Guests, Matches, validation, timestamps, or edit rights |
| [Identity and access](./spec/identity.md) | Device Bindings, onboarding, authorization, or access revocation |
| [Screens and UI](./spec/screens.md) | Feed, Log Match, Leaderboard, Player Detail, Admin UI, or gallery states |
| [Rating](./spec/rating.md) | Rating calculation, replay, projections, ranking, or Rating tests |
| [PWA and offline](./spec/pwa.md) | Installation, service workers, offline queueing, or synchronization |
| [Architecture and operations](./spec/architecture.md) | Layering, persistence, hosting, deployment, backups, or recovery |

## Cross-cutting invariants

- **Single circle.** There is no Group entity. A second circle gets its own deployment.
- **No Player accounts.** Devices are bound to Players; one Admin has a real login.
- **The Match log is authoritative.** Ratings and statistics are derived by replay, never patched in place.
- **The domain stays framework-free.** Persistence belongs in services; UI belongs in the application and component layers.
- **Document decisions where they belong.** Update the normative topic text and append a numbered entry to that same topic's decision history. Do not duplicate a decision across topic files.
- **Keep the UI catalogue truthful.** A changed or new documented UI state changes its corresponding fixture in the same commit.

The original clean-slate rewrite was decided by Simon in grilling sessions beginning 2026-07-11. Git history preserves the former monolithic specification and its chronological layout.
