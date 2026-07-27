# Review UI states in a dev-only gallery route, not Storybook

Status: accepted

PadelClash renders every documented UI state as fixture-driven cases under a
`/dev/gallery` route inside the app itself, guarded by
`NODE_ENV === "production"`. The production build still contains inert gallery
route modules and fixture chunks; the guard's 404 is the boundary, not bundle
elimination. The goal is eyes-on review — seeing the blocked-sync card, an
expired invitation, or a guest headline without contriving server
conditions — not visual-regression diffing in CI, which a one-circle private app
does not earn. Because the gallery is ordinary app routes, cases render through
the real Tailwind build, real fonts, and real server components, so what is
reviewed is literally the app rather than a parallel rendering of it.

We rejected Storybook, the obvious industry answer. It adds a large dependency
tree and a second build to keep green, against a codebase whose stated
convention is to keep `package.json` clean (the `verify` skill installs
Playwright in a session scratchpad for exactly this reason), and its React
Server Component support is still experimental on a Next 16 that `AGENTS.md`
already warns is not the Next.js anyone's training data knows. We also rejected
a fixture data layer behind a dev flag — it would put one flag in charge of what
the real app reads — and a static design mock, which drifts the moment code
ships.

## Consequences

Two seams exist in application code purely to serve review, and both look
unmotivated without this ADR:

- **Route pages split into an async loader and a pure view.** `FeedPage` keeps
  the `viewerForPrivateRead()` / `getFeed()` calls and delegates rendering to
  `FeedView`, which takes props. Screen-level states — the empty feed, the
  unbound visitor, the admin identity line — are otherwise unreachable without a
  database. The views become unit-testable as a side effect.
- **Interactive components accept their server action as an optional prop
  defaulting to the real import** (`deleteMatch = deleteMatchAction`). Nothing in
  production ever passes it. The gallery passes a never-resolving stub to freeze
  a pending state and a rejecting stub to show an error, neither of which is
  reachable from props alone because those states live in `useTransition`.

Completeness is guaranteed mechanically only where the domain already closes the
set. Closed unions — `InvitationState`, `PlayerStatus`, `MatchSyncRefusal`, and
CVA variant keys — are galleried through `Record<Union, Case>`, so adding a
member fails the build until it is covered. Open combinatorics (singles/doubles
× set count × guest × edit rights × admin) are hand-curated named scenarios
checked against `docs/ui/`, and can be forgotten. This split is deliberate and
should not be read as an oversight in the uncovered half.

Screen cases render inside fixed-width iframes at phone widths. The app shell
anchors the tab bar to the viewport (decision 86) and treats page-level
horizontal scroll as a defect (decision 88); rendered inline down a scrolling
gallery page, both behaviours would report falsely.

Fixtures are hand-written literals rather than replay-engine output, so they can
be deliberately abusive — very long names, three-digit deltas, five sets. The
gallery stresses layout; it does not simulate a truthful rating history.
