# Next Match summary — visual-variant handoff

**Status:** Variant A selected and production-integrated  
**Date:** 2026-08-30  
**Primary viewport:** installed mobile PWA at 320, 390, and 430 px widths

## Outcome

Simon selected Variant A's current gold-outline row treatment on 2026-08-30.
The production behavior and selected presentation are normative in
[`docs/ui/log-match.md`](../ui/log-match.md) and Screens decisions 159–160.

## Historical assignment (superseded)

The remainder of this file records the completed comparison brief. Its spike
instructions are retained as design history and no longer direct implementation.

Produce five working variants of the actions in the new `Next match` section
inside the real Log Match summary. Freeze the payoff, section heading, slogan,
spacing, and action order so the comparison is about the buttons rather than
five competing screen designs. Present the variants in `/dev/gallery/log` so
Simon can compare them at the supported phone widths before choosing a
production design.

This first pass is a design spike. Do not wire a variant into the production
Match submission flow, replace the current `Log another match` behavior, or
commit to a final component API. Reuse real production primitives and styles
where practical, but keep the spike easy to delete or consolidate after the
review.

The approved behavior is normative in
[`docs/ui/log-match.md`](../ui/log-match.md) and Screens decision 159. The
variants may change hierarchy, density, borders, typography, and matchup-row
treatment; they may not change the available actions or invent recommendations.

## Product behavior shared by every variant

- The result or queued confirmation remains intact at the top.
- A visually separate section below it always carries the stable label
  `Next match`.
- One slogan is drawn randomly when a production summary appears and remains
  fixed while that summary is visible. For gallery stability, each fixture
  receives an explicit slogan.
- Use only this approved copy collection:
  - `Same court, new alliances.`
  - `New teams, fresh excuses.`
  - `Different players, same problems.`
  - `New partners, same bragging rights.`
- Four ordinary doubles participants produce three actions: the two changed
  pairings first, then the prior pairing marked `Same teams`.
- A pairing action names both Sides factually and opens the fresh prefilled form
  immediately. It does not need a separate Continue action.
- `Choose different players` opens the ordinary doubles-first Logger-only form.
  In this second pass it has the same minimum height and action weight as the
  pairing choices; at least one variant uses exactly the same visual treatment.
- Singles shows `Same players` plus `Choose different players`.
- Domain-invalid Guest pairings are omitted. There is no disabled teaser for an
  arrangement the user cannot save.
- No variant calls a pairing balanced, recommended, fair, strongest, weakest,
  next in a rotation, or otherwise inferred from Rating or history.

## Variations to produce

Produce five meaningfully different button treatments. The surrounding summary
is intentionally identical in all five.

### Variant A — gold-outline rows

Use the existing outline-button language with both teams centred around a small
gold `VS`. Keep the border and typography substantial enough to read as a real
launch action rather than a table row.

### Variant B — split-court blocks

Put each Side in an attached dark panel around a primary-red `VS` block. The
different-player action uses the same boundary and a matching red `+` block.

### Variant C — numbered bout tickets

Number every choice, including the different-player action, with a primary-red
stub against the existing gold outline.

### Variant D — gold-rail list

Use the existing secondary surface with one gold left rail, literal `A` / `B`
labels, and a gold forward cue. Treat the different-player action as the final
row in the same list.

### Variant E — red action plates

Use the design system's primary CTA treatment for every choice with the existing
gold lower edge. This is the explicit equal-prominence extreme: the
different-player action is visually identical to every pairing action.

Do not add a carousel: simultaneous comparison of all pairings is part of the
approved interaction.

## Required comparison fixtures

Show each visual variant using the same data so differences are attributable to
the treatment rather than the content:

1. Online `Match logged` payoff with four roster Players and four Rating rows.
2. Queued confirmation with the same four roster Players.
3. Four deliberately long Player Names at 320 px.
4. Doubles with two Guests, proving that only domain-valid pairings appear.
5. Singles with `Same players` and `Choose different players`.

Use one pinned approved slogan across the main comparison set. A separate small
copy fixture may show all four slogans, but random rendering must not make the
gallery or screenshots unstable.

## Interaction detail to demonstrate

Alongside the summary variants, add one shared picker fixture showing the
approved occupied-Player swap behavior:

- every roster Player remains visible;
- occupied Players show their current Side;
- choosing an occupied Player swaps the two slots atomically;
- unused Players retain normal replacement behavior; and
- accessible names describe the swap rather than merely repeating a Player
  Name.

This picker fixture is not another visual-variant exercise unless a genuine
ambiguity appears during implementation.

## Constraints

- Read the relevant Next.js guide under `node_modules/next/dist/docs/` before
  changing code; this repository's Next.js conventions differ from prior
  versions.
- Use existing shadcn/ui primitives for application UI. Gallery chrome itself
  remains plain unstyled HTML so a broken primitive cannot hide the comparison.
- Preserve the Log route's async-loader/pure-view split and the optional real
  server-action defaults. Gallery-only seams must not become production inputs.
- Do not query the database from `/dev/gallery`; all cases are fixtures.
- Do not widen any closed-union gallery coverage to `Partial<>` or an array.
- Preserve the fixed bottom navigation, safe area, and no-horizontal-overflow
  behavior at 320, 390, and 430 px.
- Keep operational queue text sober and separate from the slogan.
- Do not create a Session, rotation engine, Balancer, or persistent Guest.

## Review deliverable

Return:

1. stable `/dev/gallery/log` URLs or case anchors for every variant;
2. screenshots at 320, 390, and 430 px for the primary online comparison;
3. one concise comparison of density, clarity, and PadelClash character;
4. the implementer's recommended variant and reasoning; and
5. any observed edge case that requires a product decision.

Stop after presenting the variants. Do not select one on Simon's behalf and do
not complete the production integration until Simon explicitly chooses the
visual direction.

## Acceptance criteria for the spike

- At least three structurally distinct variants render in the real gallery.
- Every variant exposes the same approved actions and ordering.
- The four-Player payoff plus Next Match section remains usable at 320 px and
  never creates horizontal page scrolling.
- Long names, queued copy, singles, and Guest filtering remain legible.
- Matchup actions meet 44 px touch targets and have complete accessible names.
- Gallery output is stable despite production's random-slogan requirement.
- No production Match flow or persisted data model changes in this phase.

No glossary term or ADR accompanies this brief. `Next match` is screen language,
not a new domain entity, and the chosen presentation remains easy to revise.
