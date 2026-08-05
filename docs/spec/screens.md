# PadelClash — Screens and UI

User-visible screens, interaction behavior, Admin UI, and the development UI-state catalogue.

This file is one part of the [PadelClash specification](../padelclash-spec.md).

## Screens

Three tabs (bottom tab bar, mobile-first — same shell pattern as the old app):

1. **Feed** (home) — reverse-chronological match cards: sides, result, per-player
   rating deltas. Edit/delete affordances where the viewer has rights.
2. **Log Match** — singles/doubles toggle, player pickers (logger pre-filled),
   winner, then either set scores or "just the winner". Payoff moment after
   submit: rating changes.
3. **Leaderboard** — ranked table of active players: rank, name, rating, W–L.
   Players below the ranked threshold (3 competitive matches) listed unranked.

**Player Detail** is a drill-in page, not a tab — reached by tapping any avatar/name
in Feed or Leaderboard (including your own). It shows the full stats package:

- current rating + rank, W–L record
- rating-over-time chart (the replay already produces the series)
- match history list
- **head-to-head**: record vs. each opponent
- **partner stats**: record with each doubles partner

All of it is computed from the match log — read-side work only, no extra tables required
beyond the two projections.

Plus small non-tab surfaces: join/bind landing (`/join/…`), admin login + admin panel.

An installation without a valid Device Binding sees a dedicated **Not Joined** screen
instead of the tab shell. Feed, Log Match, Leaderboard, Player Detail, and their server
operations validate the binding. Onboarding routes and Admin login remain reachable;
a valid Admin session may bypass the read gate as described above.

The Not Joined screen in an installed PWA also accepts a pasted invitation. The
expected input is the full same-site `/join/{token}` URL; the existing raw 256-bit
invitation token is accepted as a convenience, but there is no second short-code
credential format. Valid input continues through the ordinary read-only preview and
explicit confirmation flow so that the Device Binding cookie is created inside the
installed PWA's own storage context.

When an invitation is opened on iOS outside standalone mode, the normal join flow
remains available but is preceded by platform guidance. The reliable recovery for an
already-installed, unbound PWA is to copy the full invitation, open PadelClash, and
paste it there. The fallback is to open and accept the invitation in Safari, remove
the old Home Screen installation, and add it again from Safari so iOS can seed the new
web app's cookie store. Android keeps the normal join flow without uninstall guidance:
an in-scope link may open the installed PWA directly, and the universal paste input is
the fallback when it opens in a browser instead.

## Decision history

These decisions are normative details and rationale for this topic. When a decision conflicts with earlier prose or another decision, the higher-numbered decision is the later rule.

| # | Date | Decision | Call |
|---:|---|---|---|
| 7 | 2026-07-11 | Screens | Tabs: Feed, Log Match, Leaderboard; Player Detail as drill-in |
| 20 | 2026-07-12 | Rating chart | Hand-rolled inline SVG, no chart dependency — one line series doesn't earn recharts. Revisit only if a second chart form appears |
| 21 | 2026-07-12 | H2H/partner ordering | Most-played-together first, ties alphabetical |
| 50 | 2026-07-21 | Admin organization | Admin groups Joined, Not Joined, and Retired Players with state-appropriate binding, invitation, lifecycle, and conditional-delete controls plus one separate General Link control |
| 65 | 2026-07-22 | Rankings podium | A Top 3 stand replaces rows 1–3 rather than sitting above a complete table: in a circle of ~8–12 Players a duplicated top three costs a third of the screen to say nothing twice. The table therefore starts at #4, and ranks stay absolute. The stand renders only when three ranked Players exist — below that the plain table stands alone, because a one-Player podium reads as breakage rather than as an early state. Each plinth carries rank, Player Name and Rating but not W–L (three columns don't fit a 360 px phone, and the stand is a trophy, not a data row); #1 keeps the existing gold accent while #2 and #3 get plain borders and shorter plinths, since inventing silver and bronze tokens for one component is out of proportion. The "You" badge moves onto the plinth when the viewer is top three, otherwise it would vanish with the row that carried it |
| 66 | 2026-07-22 | Player Detail back affordance | Player Detail carries no back control, and `back-button.tsx` is deleted with it. This **reverses** the component's original argument — that an installed PWA has no browser chrome and so each drill-in must supply its own — because the tab bar is present on every screen under the tab shell and installed mobile PWAs retain system/browser history navigation: iOS edge-swipe and Android's system Back gesture/button. The accepted cost is real and was weighed: returning via the Feed tab resets scroll position, so a Player opened from deep in the feed comes back to the top. Re-adding a back control is a deliberate reversal, not an oversight to correct |
| 67 | 2026-07-22 | Feed card rows | Set Scores get their own row instead of trailing the timestamp on the mono meta line — they are the match result, not metadata about it. Card heights are explicitly allowed to vary with content (singles vs doubles, scores vs none); no padding to a uniform height |
| 68 | 2026-07-22 | Tab bar geometry and separation | The active tab's red band is reserved as a transparent border on inactive tabs so switching sections changes colour only, never layout — on Log Match neither text tab is active and the bar previously changed height. The bar also gains a short upward shadow, knowingly the first soft shadow in a theme that is otherwise flat planes and hard borders; it is kept tight and hugging so it reads as a lip rather than a glow. If the inconsistency grates, the on-theme alternative is a gradient scrim fading content out above the bar |
| 69 | 2026-07-22 | Podium bronze, and W–L on the plinths | The returned design contradicted decision 65 twice, and both were re-decided with the user. **Bronze is adopted:** #3 gets a `--podium-bronze` token, reversing 65's "no silver/bronze" on the narrow ground that one medal colour is not the pair 65 was rejecting — #2 stays plain muted and #1 keeps the existing gold, so exactly one token was added. The #1 plinth reuses `--secondary` rather than the design's new tint. **W–L is adopted:** 65 excluded it because "three columns don't fit a 360 px phone", but the design renders `rating · W–L` as a single mono line rather than as columns, which dissolves that objection. Measured at 360, 390 and 430 px: zero column overflow, no horizontal page scroll. It stays unless a future name/rating combination breaks the line |
| 70 | 2026-07-22 | Podium narrow-screen fit | Podium name type scales down fluidly on narrow phones so ordinary long names remain whole; balanced wrapping is only the fallback for names that still cannot fit. Rank numerals must remain visually inside their plinths: #3 is slightly smaller, uses normal line-height, and sits below its bronze rail rather than colliding with it |
| 71 | 2026-07-22 | Feed result density | Singles and doubles both use two team rows: the winning side and ember-red `def.` share the first baseline, with the muted losing side below. Recorded set values remain a separate result row but carry no `SETS` label because the bordered score values explain themselves |
| 72 | 2026-07-22 | Raised-nav and action balance | One upward shadow follows the combined silhouette of the nav bar and raised centre Log plate, rising around the plate and rejoining the bar rather than layering two separate shadows. Match-card Edit and Delete retain identical 40 px targets and 16 px icon boxes; Delete uses a circled X so its visible footprint matches the pencil |
| 86 | 2026-07-23 | Viewport-anchored tab bar | “Sticky” means fixed to the mobile viewport: the tab bar never travels with page scroll or iOS overscroll, its controls sit above the bottom safe area, and the tab shell reserves the bar's complete height so content is never obscured. Feed and Rankings labels increase from 12 px to 14 px. The active red rail extends inward from the active outer tab to the edge of the raised Log plate, never through or behind the plate |
| 87 | 2026-07-23 | Invitation transfer into installed PWAs | Every unbound installed PWA accepts a pasted same-site full `/join/{token}` URL or the existing raw token, then reuses the ordinary preview and explicit confirmation flow so the binding is minted in that PWA's cookie store. No human-sized short-code credential is introduced. An iOS browser shows non-blocking recovery guidance above the normal join flow: copy the full link into the installed PWA first; alternatively accept it in Safari, remove the old Home Screen app, and reinstall from Safari. Android receives no uninstall guidance because link capture may open the PWA directly and paste remains the cross-browser fallback |
| 88 | 2026-07-23 | Mobile page overflow | The application must not expose page-level horizontal scrolling at supported phone widths. Fix the element that exceeds the viewport rather than relying only on a global clipping rule; deliberately scrollable controls may retain local overflow |
| 89 | 2026-07-23 | Active rail under the Log plate | The active outer tab's red rail continues to the navigation centreline beneath the raised Log plate, which masks the inner end. This reverses decision 86's stop-at-the-plate-edge rule: the uninterrupted band reads more cleanly than a precisely measured gap beside the rotated plate |
| 125 | 2026-07-27 | Admin round-trip and invite copy | An authenticated Admin gets a small `Admin panel` control in the Rankings header's top-right action position, matching the root page logo placement, and the Admin panel mirrors it there with `Back to app` linking to `/`; logged-out viewers never see the Rankings control. Successfully generating either a Personal Link or the General Link immediately copies its full same-site `/join/{token}` URL through the same clipboard path and fallback used by the explicit copy controls. Failed generation copies nothing. |
| 126 | 2026-07-27 | UI states are reviewed in a dev-only gallery | Every named screen state documented in `docs/ui/` is rendered from fixtures as a case under `/dev/gallery`, a route in the app itself, so review happens through the real Tailwind build, real fonts, and real server components rather than a parallel rendering. The `/dev` layout calls `notFound()` when `NODE_ENV === "production"` and the production server returns 404 for every gallery URL. Turbopack still emits inert route modules and fixture chunks during the Docker build; unreachability, not dead-code elimination, is the security boundary. Unlike an opt-in env flag, the guard cannot be misconfigured from Coolify, whose environment lives outside the repository. The goal is eyes-on review — seeing a blocked-sync card or expired invitation without contriving server conditions — not CI visual-regression diffing, which one private circle does not earn. Storybook was rejected for its dependency tree, its second build, and its experimental RSC support on Next 16; see ADR 0004 |
| 127 | 2026-07-27 | Loader/view split and action injection | Route pages keep their `async` data loading and delegate rendering to a pure view taking props, so screen-level states — the empty Feed, the unbound visitor, the Admin identity line — are reachable without a database, and the views become unit-testable. Interactive components accept their server action as an optional prop defaulting to the real import, which nothing in production ever passes; the gallery supplies a never-resolving stub to freeze a pending state and a rejecting stub to show an error, neither reachable from props alone because both live in `useTransition`. `QueuedMatchCard` is already prop-driven and needs only exporting. Both seams exist solely for review and are unmotivated without decision 126 |
| 128 | 2026-07-27 | Completeness is mechanical only where the domain closes the set | Closed unions — `InvitationState`, `PlayerStatus`, `MatchSyncRefusal`, and CVA variant keys — are galleried as `Record<Union, Case>`, so adding a member fails `tsc` until it is covered. Open combinatorics (singles/doubles × set count × Guest × edit rights × Admin) are hand-curated named scenarios checked against `docs/ui/`, and can be forgotten; the honest split is recorded rather than papered over with a cartesian generator whose signal would drown in hundreds of meaningless cards. Screen cases render in fixed-width iframes at 320 / 390 / 430, because the viewport-anchored tab bar (decision 86) and the no-horizontal-scroll rule (decision 88) both report falsely when rendered inline down a scrolling page. Fixtures are hand-written literals, not replay-engine output, so they can be deliberately abusive — long names, three-digit deltas, five sets — since the gallery stresses layout rather than simulating a truthful Rating history |
| 130 | 2026-07-31 | Doubles-first logging | A new or reset Log Match form starts in Doubles, and Doubles is the left-hand mode option. Existing Matches and gallery action fixtures continue to open in the format represented by their draft |
| 131 | 2026-07-31 | Long-name Log Match coverage | Winner controls remain two side-by-side team cards around `VS`. Each active participant slot gets one single-line row within the Side's card, with empty-slot placeholders preserving the two-row doubles layout; overlong names truncate with an ellipsis instead of wrapping or breaking, while a Guest marker never truncates. A dedicated gallery case exercises four long doubles names at 320, 390 and 430 pixels |
| 132 | 2026-07-31 | Searchable bounded participant pickers | Every Log Match participant picker opens with a visible Player search field followed by a locally scrolling option list. The popup has a defined maximum height, keeps search visible while results scroll, hides the native scrollbar, and uses top/bottom shadows that appear only when more results exist in that direction. It stays within a 16px phone-viewport gutter and ellipsizes long selected names and option labels instead of causing page-level horizontal overflow |
| 133 | 2026-07-31 | Pull-to-refresh on read-heavy tabs | Feed and Rankings support the familiar downward pull only while the app's sole `#scroll-root` scroller is at its top. Crossing a visible threshold and releasing calls the App Router's `router.refresh()`, preserving client/browser state while re-running the route's private server reads; short pulls do nothing. The gesture translates only page content, never the viewport-fixed tab bar. Log Match is excluded because an accidental refresh gesture on an input-heavy draft is more harmful than useful. Pulling, release-ready and refreshing states are fixture-reachable in both screens' gallery catalogues, expressed as `Record<PullIndicatorPhase, Case>` so a new closed phase fails typechecking until both catalogues cover it |
| 134 | 2026-08-04 | Compact searchable Admin roster | General Onboarding and Add Player remain the two sections above the roster. A live, case-insensitive Player Name search spans Joined, Not Joined, and Retired while preserving those groups; zero-match groups hide during a query and a total miss shows one empty result. Groups do not collapse. A closed Player row shows only the Player Name and an expand affordance, and one shared accordion permits at most one expanded Player across the roster. The expanded panel retains the current status details, Device history disclosure, actions, confirmations, and failure behavior; the redesign changes disclosure and findability, not management semantics |
| 135 | 2026-08-04 | Alphabetical Player selection | Player Names sort alphabetically within each Admin status group and in the shared Log/Edit Match participant picker. Picker filtering and removal of Players already selected in another slot preserve the alphabetical order of the remaining options. No Feed, Leaderboard, match-history, or Guest ordering changes |
| 147 | 2026-08-04 | Small truthful Admin surface | `Database backup` is the final Admin Panel section. It explains that the dump contains all private data, offers one `Download backup` action, disables duplicate attempts while preparing, and presents inline generation failures without exposing process output. It lists no scheduled archives and contains no upload or restore control. Idle, preparing, and failure states are represented in `/dev/gallery` |
| 150 | 2026-08-05 | Newly created Player handoff | After Add Player succeeds, the new Player remains beneath the form in a permanently open management panel so Admin can immediately issue a Personal Link. That Player is omitted from Search and the normal status groups only while the current Admin page instance remains mounted; the next visit places them in the ordinary roster. `Log out` leaves the header and shares the final `Admin tools` zone with database backup. |
| 151 | 2026-08-05 | Confirm Admin logout | `Log out` in Admin tools opens a confirmation before ending the Admin session. The dialog warns that the Admin password is required to return; cancelling preserves the session and only the explicit confirm action logs out. |
