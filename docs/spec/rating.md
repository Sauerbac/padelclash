# PadelClash — Rating

The Rating engine, replay/projection behavior, ranking rules, and acceptance anchors.

This file is one part of the [PadelClash specification](../padelclash-spec.md).

## Rating engine

The existing framework-free engine at `src/domain/rating/` remains the
architectural base, but its old `K = 32`, shared Side delta, equal doubles split,
floating-point output, and result-only behavior are superseded. The live
design rationale is recorded in
[ADR 0003](../adr/0003-use-independent-player-elo-for-team-matches.md). The live
constants are:

- starting Rating: **1000**
- logistic divisor: **400**
- Established Player factor: **K = 50**
- Provisional Player factor: a taper of **80, 70, 60** across their first three
  rated Matches, expressed as `max(50, 80 − 10 × priorRatedMatches)`
- final per-Player magnitude: an integer with a floor of **1** and no ceiling
- rated threshold: **3** — one constant governing the K taper, Provisional
  status, and Leaderboard rank alike

Every Match is evaluated from one immutable snapshot of all participating
Players' pre-Match state:

1. If the Match contains a Guest, calculate one hidden Guest Rating as the
   arithmetic mean of every participating Player's pre-Match Rating. Every Guest
   in that Match uses that same input Rating.
2. For each Player independently, calculate the opposing Side's mean from its
   Player Ratings and hidden Guest Rating, if present. The Player's own partner
   does not enter this expectation.
3. Calculate the Player's expected score:

   ```text
   expected = 1 / (1 + 10 ^ ((opposingMean - playerRating) / 400))
   ```

4. Derive the Player's K from how many rated Matches they had completed before
   this one, then calculate the unsigned result magnitude:

   ```text
   K    = max(50, 80 - 10 × priorRatedMatches)
   base = K × (winner ? 1 - expected : expected)
   ```

5. A Simple Result has multiplier `1`. For a Set Score, orient all games and
   sets to the declared winner and calculate:

   ```text
   gamesRatio = max(0, winnerGames - loserGames) / totalGames
   setMargin  = (winnerSets - loserSets) / totalSets
   dominance  = clamp(gamesRatio × setMargin, 0, 1)
   multiplier = 1 + 0.4 × dominance
   ```

6. Calculate `Math.round(base × multiplier)`, raise it to `1` if it rounded to
   zero, then apply a positive sign to a winner or negative sign to a loser.
   All quantities through the floor use full precision; only the positive final
   magnitude is rounded.
7. Emit and persist output only for Players. A Guest receives no history row,
   match count, or updated Rating. A Guest Match still increments each
   participating Player's rated Match count.

All Player updates in a Match use the same pre-Match snapshot, so iteration
order cannot affect the result. The independent expectations are deliberately
not one shared team win probability and need not be complementary across the
four participants. Projection data names this value `expectedScore`; it must not
be presented as a canonical team probability.

Acceptance anchors:

| Scenario | Winner change | Loser change |
|---|---:|---:|
| Equal Established Players, Simple Result | `+25` | `−25` |
| Equal Established Players, `6–0, 6–0` | `+35` | `−35` |
| Equal Established Players, `6–3, 6–3` | `+28` | `−28` |
| Equal Established Players, `6–0, 0–6, 6–0` | `+26` | `−26` |
| 800/1200 Side beats 1000/1000, Simple Result | `+38 / +12` | `−25 / −25` |
| 800/1200 Side loses to 1000/1000, Simple Result | `+25 / +25` | `−12 / −38` |
| 200-point underdog wins `6–0, 6–0`, Established | `+53` | `−53` |
| Equal Players, first placement Match, Simple Result | `+40` | `−40` |
| Equal Players, second placement Match, Simple Result | `+35` | `−35` |
| Equal Players, third placement Match, Simple Result | `+30` | `−30` |
| Equal Players, first placement Match, `6–0, 6–0` | `+56` | `−56` |

The last four rows are the only place the taper is visible: from the fourth
rated Match on, every anchor above uses `K = 50`.

The Rating Pool is not conserved. Independent Player updates can create or
remove Rating, and 1000 is a fixed starting reference rather than an enforced
circle average. Ratings and final deltas are integers and have no lifetime
floor; expected scores and the hidden Guest Rating may be fractional.

A per-Match magnitude has no ceiling: K alone bounds it, at `50 × 1.4 = 70` for
an Established Player and `80 × 1.4 = 112` in a first placement Match. Both
bounds require a near-total mismatch and a shutout simultaneously, and reaching
them is the intended behaviour rather than an edge case to suppress.

Replay still filters and sorts by the total order **(playedAt, loggedAt, id)**
before folding, so edits, deletions, and late syncs are handled by rebuilding.
It emits `rating_history` for Players who participated and `current_rating` for
Players seen during replay; `rankMap()` remains the one definition of
leaderboard ordering.

Keep the synchronous materialized projection approach (restated here as a live
decision): on every match write/edit/delete, replay the (small) log in the same
transaction and rewrite the two projection tables. At private-circle scale this
stays trivially fast forever, and a long-lived container on Coolify has no
execution-time constraints.

The app supplies only competitive, confirmed Matches. Compatibility fields for
future casual or confirmation features may remain in the engine input, but they
do not change the v1 Match model.

## Decision history

These decisions are normative details and rationale for this topic. When a decision conflicts with earlier prose or another decision, the higher-numbered decision is the later rule.

| # | Date | Decision | Call |
|---:|---|---|---|
| 6 | 2026-07-11 | Elo input | **Superseded by decisions 90–109.** Set Scores now provide a capped, sign-preserving Rating bonus; Simple Result remains first-class |
| 90 | 2026-07-23 | Rating direction invariant | A Match winner always gains Rating and a loser always loses Rating. The Player's own strength, the opposing Side's strength, provisional state, and Set Score detail may scale the magnitude but never reverse its sign; the circle values an intuitive post-match payoff over the extra predictive information of rewarding an above-expectation loss or penalizing an underwhelming win |
| 91 | 2026-07-23 | Rating responsiveness | The rating refinement will make results genuinely move the Rating and leaderboard faster, not merely multiply the displayed units. An ordinary unscored Match between established 1000-rated Players changes every participant by exactly 25 Rating points: `+25 / −25` in singles and `+25 / +25 / −25 / −25` in doubles. This calibration point is behavior, not merely presentation |
| 92 | 2026-07-23 | Rating Pool conservation | The Rating Pool is not conserved. Each Player receives an independent Elo update against the opposing Side's mean Rating, following the battle-tested Age of Empires II team-Elo model: a lower-rated winner gains more than their higher-rated partner, while a higher-rated loser loses more than their lower-rated partner. The sum of gains need not equal the sum of losses, and 1000 remains a starting reference rather than an enforced circle average |
| 93 | 2026-07-23 | Set Score direction and incentive | A Simple Result receives the normal Elo movement. Recording Set Scores can only preserve or increase that magnitude, never reduce it: a close scored result is worth approximately the Simple Result, while greater dominance earns a capped bonus. This sign-preserving, bonus-only rule prevents Players from gaining an advantage by omitting an inconveniently close score |
| 94 | 2026-07-23 | Set Score dominance | **Superseded by decision 121.** The initial design used a games-only ratio, `max(0, winnerGames − loserGames) / totalGames`, which ignored set outcomes entirely and could therefore rate a win that dropped a set above a straight-sets win |
| 95 | 2026-07-23 | Set Score maximum bonus | Set Score dominance multiplies every participant's independently calculated Elo magnitude by at most `1.4`. A complete shutout between equally rated established Players therefore changes each Rating by 35 instead of the Simple Result's 25; the shared multiplier preserves the weaker-winner and stronger-loser ordering |
| 96 | 2026-07-23 | Set Score bonus curve | The score multiplier grows linearly as `1 + 0.4 × dominance`. For equally rated established Players, representative changes are approximately 25 for `7–6, 6–7, 7–6`, 27 for `6–4, 6–4`, 30 for `6–2, 6–2`, and 35 for `6–0, 6–0` |
| 97 | 2026-07-23 | Per-Match Rating cap | **Superseded by decision 119.** The initial design capped every Player's final signed change at `±50` per Match. That ceiling was calibrated against decision 101's `K = 100` and outlived it |
| 98 | 2026-07-23 | Shared format Rating | Singles and doubles update the same Player Rating and the same leaderboard. The individual-versus-opposing-average doubles formula reduces to ordinary head-to-head Elo for singles, and an ordinary balanced unscored Match produces the same per-Player `±25` baseline in either format |
| 99 | 2026-07-23 | One-off Guest Rating | A Guest is a named, match-scoped participant rather than a roster Player. For that Match only, every Guest receives a hidden Rating equal to the arithmetic mean of all non-Guest participants' pre-Match Ratings. Only real Players receive Rating outputs; the Guest never receives a profile, Device Binding, leaderboard entry, or cross-Match history |
| 100 | 2026-07-23 | Provisional boundary | A persistent Player is Provisional for their first three rated Matches and becomes Established immediately after completing the third; their fourth Match uses the standard rules. Provisional status and match count are derived during replay, so edits and deletions can move the boundary. This reuses the existing three-Match threshold before a Player qualifies for leaderboard rank |
| 101 | 2026-07-23 | Provisional update speed | **Superseded by decision 120.** The initial design used `K = 100` during each of a Player's first three rated Matches, producing a raw `±50` change at equal Rating |
| 102 | 2026-07-23 | Established Players in placement Matches | Provisional status affects only the Provisional Player's own update. Every Established Player always uses the normal `K = 50`, even when a teammate or opponent is Provisional; there is no reduced-impact or protection rule for the established participants |
| 103 | 2026-07-23 | Rating expectation curve | The individual Elo expectation retains the classic 400-point logistic divisor. With established `K = 50`, an unscored win before the final cap is worth approximately 25 at equal Rating, 18 when the Player is 100 above the opposing Side's mean, 32 when 100 below, 12 when 200 above, and 38 when 200 below; losses mirror those magnitudes |
| 104 | 2026-07-23 | Persistent Player starting Rating | Every persistent Player starts at the fixed Rating of 1000, regardless of the current Rating Pool or circle average. The three Provisional Matches, rather than a moving initial seed, place newcomers; the match-scoped mean used for a Guest remains a separate rule |
| 105 | 2026-07-23 | Guest Matches during placement | A rated Match containing a Guest counts toward every participating Provisional Player's three-Match placement phase. It moves their Rating at the current point on the K taper like any other placement Match; there is no separate confidence or match-count rule for Guest participation |
| 106 | 2026-07-23 | Rating migration | The new rating algorithm applies by replaying the complete historical Match log, not only Matches recorded after deployment. Historical feed deltas, each Player's first three Provisional updates, Set Score bonuses, Rating charts, and the current leaderboard are all recalculated under one formula; no permanent algorithm-version cutover or mixed-scale history is retained. At design time the log contains only four Matches, all Simple Results, so no legacy Set Score fallback is required. Recheck that fact immediately before rollout; any Set Scores added in the meantime must satisfy the normal consistency rules |
| 108 | 2026-07-23 | Per-Match Rating floor | After every expectation, K factor, and Set Score multiplier is applied, each real Player's final signed Rating change has an absolute minimum of 1. Every winner therefore gains at least `+1` and every loser loses at least `−1`; the engine cannot produce a change that the integer UI renders as `±0`. The floor only binds beyond roughly an 800-point Rating gap, so it does not meaningfully distort Elo's self-correction at this circle's scale |
| 109 | 2026-07-23 | Integer Rating arithmetic | A Player's final positive Rating-change magnitude is rounded to the nearest whole point, raised to 1 if it rounded to zero, and then given the win/loss sign before it is applied. Player Ratings, history deltas, and before/after values therefore remain integers and exactly match every UI surface; expected probabilities and hidden Guest means may remain fractional calculation inputs |
| 113 | 2026-07-23 | Rating range | A Player's lifetime Rating has no hard minimum and may become negative. The fixed 1000 starting Rating and Elo's own self-correction — a Player far below the field faces low expectations and therefore loses little — make that outcome remote, while an unbounded scale preserves the invariant that every loss costs at least one point without a special case at zero |
| 114 | 2026-07-23 | Provisional score ceiling | **Superseded by decision 120**, via 118. Under the initial `K = 100` design, an equally rated Provisional Player already reached `±50` from a Simple Result, so a shutout could not move them farther |
| 115 | 2026-07-23 | Match evaluation snapshot | Every Player's independent expectation and Guest input is calculated from one pre-Match Rating snapshot. A Player is compared only with the opposing Side's mean; the teammate's Rating does not directly enter that Player's expectation, and participant iteration order cannot change the outcome. The projected value is called `expectedScore`, not team win probability, because the independent Player expectations need not be complementary |
| 117 | 2026-07-23 | Guest uncertainty trade-off | A Guest's actual skill is deliberately not estimated or persisted. Using the participating Players' mean is a neutral one-Match approximation that can misrate an unusually strong or weak Guest; the private circle's trust model is the accepted safeguard, and no extra protection rule is added for Established Players |
| 118 | 2026-07-23 | Provisional K adjustment | **Superseded by decision 120.** An intermediate design reduced the flat Provisional factor from `K = 100` to `K = 70`, chosen so an equally rated shutout landed at 49 — one point under decision 97's ceiling. Removing that ceiling voided the calibration |
| 119 | 2026-07-27 | Per-Match cap removed | The `±50` cap of decision 97 is deleted; K alone bounds a per-Match change, at `70` for an Established Player and `112` in a first placement Match. The cap was calibrated against decision 101's `K = 100`, where it genuinely prevented a `±140` swing, and survived the reduction to `K = 70` without its rationale. At the shipped constants it bound only on big upsets and shutouts — precisely the most informative results — flattening decisions 92, 95, 96 and 103 to a constant exactly where they should vary most. Reaching the new bounds requires a near-total mismatch and a shutout at once, which is the intended payoff rather than an edge case to suppress |
| 120 | 2026-07-27 | Placement K taper | The flat Provisional factor is replaced by `K = max(50, 80 − 10 × priorRatedMatches)`, giving `80, 70, 60` across a Player's three placement Matches and `50` from the fourth on. This removes the perceptible 40% cliff between Match 3 and Match 4 that a flat factor created at a boundary no Player can predict, while landing a strong newcomer at the same Rating the shipped flat `K = 70` produced, so no re-calibration of decision 91's `±25` baseline is required. The formula reaches `50` exactly at the threshold, so the taper needs no separate clamp and cannot drift from the Established factor |
| 121 | 2026-07-27 | Set-margin-weighted dominance | Set Score dominance becomes `clamp(gamesRatio × setMargin, 0, 1)`, where `gamesRatio` is decision 94's games ratio and `setMargin` is `(winnerSets − loserSets) / totalSets`. The games-only metric ignored set outcomes, so `6–4, 6–4` scored below `6–0, 0–6, 6–1` — the Player who was bagelled in a set out-earned the Player who never dropped one — and rated `6–3, 6–3` identically to `6–0, 0–6, 6–0`. Not losing a set is itself evidence of dominance. Straight-sets results are unaffected, so decision 96's published curve (25 / 27 / 30 / 35) still holds; only results that drop a set are reduced. A contradictory score yields a negative set margin, which clamps to zero and degrades the Match to Simple Result movement, preserving decision 93's bonus-only rule |
| 122 | 2026-07-27 | Rating rollout preflight retired | The boot-time `ratingRolloutPreflight` scan is deleted and decision 106's "recheck immediately before rollout" is recorded as discharged by a one-off manual check. It enforced decision 107's Set Score consistency on every server start and exited the process on failure, so one bad historical row would have refused all traffic on Coolify with no recourse but hand-editing Postgres. `validateSets` already gates every write, making a violating row unreachable after a single verification, and decision 121's clamp degrades one to a Simple Result anyway. Boot remains `migrate` then full projection rebuild, both fatal on failure, called as two steps from `instrumentation.ts` so the database layer no longer imports the match service |
| 123 | 2026-07-27 | One rated threshold | A single constant, `RATED_THRESHOLD = 3`, governs the K taper, Provisional status, and Leaderboard rank. `projectGroup`'s unused `rankedThreshold` override is deleted: it had no caller in the application or the tests and existed only to let `isRanked` diverge from `isProvisional`, which had already happened in the shipped code. Two names for one number cannot drift once there is one number |
| 152 | 2026-08-05 | Unique Rank tiebreak chain | Active Established Players keep unique leaderboard Ranks. Higher Rating leads; equal Ratings are resolved by more competitive wins, then more total competitive Matches, then earlier roster creation time. Player ID is used only as a deterministic fallback when creation timestamps are also identical. The resulting top three populate the existing podium positions. |
