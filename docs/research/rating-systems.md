# Rating systems for PadelClash Lite

Research date: 2026-07-23

Status: research complete. The adopted design is authoritative in
[`docs/spec/rating.md`](../spec/rating.md#rating-engine) and
[ADR 0003](../adr/0003-use-independent-player-elo-for-team-matches.md). The
recommendations below are research inputs, not unresolved product decisions.

## Question

PadelClash currently uses win/loss Elo with a 1000 starting rating, `K = 32`,
a 400-point logistic divisor, the mean rating of each Side, and an equal split
of the Side's delta between its Players. This note compares established systems
that could make the result feel more eventful while remaining understandable
for a small private circle.

The desired cases are:

- common doubles results should not all look like `+8 / -8`;
- on a win, the lower-rated partner should gain more than the higher-rated
  partner; on a loss, the higher-rated partner should lose more;
- both Simple Results and Set Scores must work;
- singles must have deliberate semantics;
- a fourth participant need not have joined the app.

## Why the example is a wall of eights

For equally rated Sides, Elo expects each Side to win with probability `0.5`.
The winning Side therefore receives:

```text
32 × (1 - 0.5) = 16
```

PadelClash divides that Side delta between two partners, so each gets `+8` and
each loser gets `-8`.

The partner rotations in the supplied four-match session keep the Side means
almost exactly equal. In the fourth match the Side ratings differ by only 16
points, producing about `±7.63` per Player, which the UI rounds to `±8`.
The repeated display is therefore the combined result of:

1. splitting one Elo update between two partners;
2. well-balanced Side averages; and
3. integer rounding hiding small differences.

## The important distinction: scale versus behavior

Rating units are arbitrary. Microsoft notes that TrueSkill can perform its
calculations on one scale and multiply the result onto another display range.
([Microsoft TrueSkill overview](https://www.microsoft.com/en-us/research/project/trueskill-ranking-system/))

PadelClash could double every distance from 1000 while doubling both `K` and the
logistic divisor. A typical `±8` would then display as `±16`, but ranks and win
probabilities would be identical. That is a **unit rescale**, not a more
responsive algorithm.

Increasing `K` without rescaling the divisor is different. It makes each new
result move the standings faster and makes ratings noisier. FIDE describes `K`
as the rating system's stabilizing influence: larger values turn ratings over
in fewer games. ([FIDE rating-regulation commentary](https://old.fide.com/fide/handbook.html?id=172&view=article))

The product must decide whether "bigger" means:

- bigger-looking numbers;
- faster movement in the leaderboard; or
- both.

## Systems and lessons

### 1. Elo: keep the transparent core

Classic Elo is easy to explain: movement is proportional to the difference
between the actual result and the expected result. It guarantees that a winner
gains and a loser loses when the actual score is `1` or `0`.

For PadelClash, the useful extension points are the team-strength calculation,
the per-Player expectation, `K`, a Set Score multiplier, and provisional
handling. A wholesale replacement is not necessary to get the desired
behavior.

### 2. Age of Empires II team Elo: the exact teammate precedent

Age of Empires II originally gave all teammates the same change based on team
average. It found that high-rated Players could be inflated by repeatedly
teaming with lower-rated Players. In 2022 it changed team Elo so that each
Player's rating is compared with the opposing team's average.

Its official example has a 2000/1000 team beat a 1500/1500 team:

- the 2000 Player gains `+2`;
- the 1000 Player gains `+30`;
- each 1500 opponent loses `-16`.

([Official Age of Empires II team Elo change](https://www.ageofempires.com/news/updates-to-ranked-team-game-elo-calculation/))

This produces the requested direction:

- lower-rated partner: lower individual expectation, therefore more gain on a
  win and less loss on a defeat;
- higher-rated partner: higher individual expectation, therefore less gain on
  a win and more loss on a defeat.

The loss behavior is an inference from applying the same published Elo
calculation with an actual result of zero.

This approach is intuitive and has an anti-boosting rationale, but it is not
neutral evidence about individual contribution. A team result only proves that
one Side beat the other. A PadelClash version must also decide whether to accept
the raw independent updates, which need not conserve rating exactly in every
possible four-rating configuration, or normalize them into an exactly
zero-sum Side transfer.

### 3. TrueSkill: team-native uncertainty, but not score-aware

Microsoft's TrueSkill tracks a mean skill and an uncertainty for every Player,
supports teams directly, and has large early changes that shrink as the system
becomes confident. It distributes a team's change in proportion to individual
uncertainty, not according to who has the lower mean rating. It also uses only
the team ordering: a one-point win and a blowout are the same.

Microsoft explicitly warns that a two-team result contains little information
about the individual Players. If two partners always play together, TrueSkill
cannot distinguish them; varied partners are what let the model learn.
([Microsoft TrueSkill overview and team FAQ](https://www.microsoft.com/en-us/research/project/trueskill-ranking-system/),
[original TrueSkill paper](https://www.microsoft.com/en-us/research/publication/trueskilltm-a-bayesian-skill-rating-system/))

Lesson for PadelClash: uncertainty is the statistically grounded reason for
different partner deltas. Lower rating alone is a deliberate fairness and
anti-boosting policy. The circle's rotating partners make individual inference
more credible than fixed teams would.

### 4. Glicko/Glicko-2: excellent uncertainty model, awkward for teams

Glicko adds rating deviation; Glicko-2 also adds volatility. Uncertain or
returning Players can move more, while established Players stabilize.
([Glicko-2 specification](https://www.glicko.net/glicko/glicko2.pdf),
[Glickman's official overview](https://www.glicko.net/glicko.html))

Glicko was designed for head-to-head competition, not team inference. Microsoft
contrasts this with TrueSkill's team model. It is therefore a good source for a
simple provisional phase, but not the cleanest wholesale doubles replacement.

### 5. UTR Tennis: score-aware doubles with equal partner movement

UTR compares the average rating of one doubles team with the average of the
other, predicts a percentage of games won, and compares actual game share with
that expectation. Both partners move by the same amount. UTR uses a weighted
average of up to 30 recent matches in the last 12 months; one match yields a
projected rating and roughly five yield a reliable one.

([Official UTR methodology](https://www.utrsports.net/pages/how-utr-works),
[official UTR doubles FAQ](https://support.universaltennis.com/en/support/solutions/articles/9000183289-faq-doubles-algorithm))

UTR is a strong racket-sport precedent for using Set Scores, but it does not
satisfy the requested asymmetric partner reward. Because it measures
performance against an expected score, an underwhelming win can lower a rating
and a strong loss can raise it.

### 6. DUPR Pickleball: the score-versus-intuition trade-off in public

DUPR's current 2026 explanation compares actual points with an expected score.
A favorite expected to win 11-3 but winning only 11-8 can lose rating, while the
loser gains. It also weights match type, recency, and match volume.
([Current DUPR calculation explanation, 2026-06-12](https://www.dupr.com/post/how-your-dupr-rating-is-calculated))

DUPR previously used a useful middle ground called **Win Intensity**. It kept
the intuitive invariant that a winner goes up and a loser goes down, but a
close win moved little and a blowout moved much more. DUPR reported that score
data added predictive value, while acknowledging that the fully score-driven
model could frustrate winners.
([DUPR Win Intensity design, 2024-01-30](https://www.dupr.com/post/dupr-progress-report-january-2024))

The current fully performance-based DUPR and its earlier sign-preserving model
are the clearest primary-source statement of PadelClash's choice:

- optimize skill estimation, allowing a rating loss after a win; or
- preserve the emotional contract of winning, using score only to scale the
  magnitude.

### 7. USTA NTRP: score-aware but equal partners

USTA's Dynamic NTRP uses the score plus the ratings of the Player, partner, and
opponents. A result better than the expected margin moves more; a win can lower
a rating and a loss can raise one. The outcome effect is applied equally to
both partners. Self-rated Players do not affect established dynamic ratings
until they have enough anchored results.
([Official USTA NTRP FAQ](https://www.usta.com/en/home/play/adult-tennis/programs/national/usta-ntrp-ratings-faqs.html))

This is another battle-tested precedent for both score awareness and protecting
established ratings from an unknown newcomer.

### 8. Playtomic and World Padel Rating: confidence is mainstream in padel

Playtomic uses every Player's level, the partner and opponent levels, and
individual reliability. New Players move more; established Players move less,
so partners can receive different changes. Its public documentation does not
publish the exact formula.
([Official Playtomic level methodology](https://playerhelp.playtomic.com/hc/en-gb/articles/43310980754193-How-the-Playtomic-level-system-works))

World Padel Rating similarly uses individual ratings and confidence. It allows
an underperforming winner to go down and an overperforming loser to go up, and
reduces confidence during inactivity. Its detailed formula is proprietary.
([Official World Padel Rating FAQ](https://www.redpadel.com/FAQ/))

These systems support adding a small, transparent provisional mechanism, but
their opaque formulas are poor templates for PadelClash's replayable crown
jewel.

### 9. FIP ranking: a separate fun layer

The professional FIP ranking awards large tournament points based on event
category and round reached, retaining a Player's best 22 results on a rolling
52-week cycle. It is a progression/ranking system, not a predictive Elo system.
([Official FIP 2026 ranking rules](https://www.padelfip.com/ranking-system-points-breakdown/))

If one number cannot be both statistically calm and emotionally generous, a
separate season-points, streak, upset, or trophy layer is a proven alternative.
It should not be confused with the skill Rating.

## The four concrete cases

### A. Different partner deltas

Two defensible policies exist:

1. **Independent Elo expectations (Age of Empires style).** Compare each Player
   with the opposing Side's average. This directly creates the requested
   lower-rated-winner/higher-rated-loser behavior and counters a strong Player
   farming rating with a weaker partner.
2. **Fixed Side pot with asymmetric allocation.** First calculate one
   zero-sum Side transfer, then give the lower-rated winner a larger share and
   the higher-rated loser a larger negative share. Cap the skew so a partner
   never receives a near-zero or extreme change.

The first has a battle-tested precedent and a simpler explanation. The second
preserves PadelClash's existing exact conservation property. A normalized
hybrid can use the independent Elo amounts as weights for distributing a fixed
Side pot.

### B. Simple Result versus Set Score

There are three established policies:

1. **Result only:** TrueSkill and current PadelClash ignore margin. Simple and
   scored matches have identical rating semantics.
2. **Sign-preserving intensity:** the older DUPR model guarantees that winners
   gain and losers lose, while dominant scores multiply the movement. This
   best matches an entertainment-first private circle.
3. **Performance versus expected score:** current DUPR, UTR, USTA, and WPR use
   score performance as evidence. A winner can lose rating and a loser can gain.
   This is more information-rich but violates the intuitive win contract.

Because Simple Result is first-class, it needs a declared fallback. A practical
sign-preserving design is:

- Simple Result: low-information baseline weight;
- Set Score: the same minimum weight for a close result, rising to a capped
  bonus for dominance.

Giving an unscored win more credit than a recorded close win would encourage
omitting scores. The multiplier must avoid that incentive.

### C. Singles

The current shared Rating already supports singles, but an equal singles result
moves each Player `±16` while an equal doubles result moves each Player `±8`.
That difference comes only from splitting the doubles Side delta.

An individual-expectation Elo naturally reduces to ordinary Elo in singles.
With `K = 32`, an even singles match gives `±16`; a doubles implementation can
also target roughly `±16` per Player before partner and score adjustments.

UTR and DUPR keep separate singles and doubles ratings because the formats test
different skills. For a small circle, separate ratings risk sparse, confusing
leaderboards. One shared Rating is the simpler default unless singles volume is
high enough to justify a separate ladder.

### D. Three joined Players and one unjoined Player

PadelClash has no Player accounts. It has:

- a **Player**, which is the enduring roster and rating identity; and
- an optional **Device Binding**, which lets that Player use the app.

The fourth participant can therefore be added as a Not Joined Player and take
part in a Match without installing or joining the app. A joined Player may log
the result for all four. If the person is not yet on the roster, the current
flow requires creating the Player first. Reusing a generic "Guest" identity
would mix different people's histories and should be avoided.

The subsequent product grill refined this concern: it adopted a named
**match-scoped** Guest rather than a reusable generic Guest identity. Nothing is
shared across Matches, and no Guest history or Rating survives, so different
one-off people are never mixed into one profile.

The remaining rating choice is provisional treatment:

- **Current behavior:** start at 1000 and update all four fully.
- **Protected initialization:** move the newcomer quickly but reduce or defer
  effects on established Players until the newcomer is anchored.

DUPR currently says initialization matches count toward the new Player's
rating without affecting others; USTA likewise withholds effects from
self-rated Players until sufficient dynamic results exist.
([Official DUPR initialization](https://www.dupr.com/what-is-dupr),
[Official USTA NTRP FAQ](https://www.usta.com/en/home/play/adult-tennis/programs/national/usta-ntrp-ratings-faqs.html))

PadelClash already hides rank until three matches. Reusing that three-match
threshold for a transparent provisional phase would be simpler than importing
a full confidence model.

## Recommended direction to grill

Do not replace the pure replay engine with an opaque external algorithm. Keep a
small Elo-family model and decide these branches explicitly:

1. Make ordinary doubles movement feel like roughly `±16`, then decide whether
   that is a cosmetic unit rescale or genuine extra responsiveness.
2. Use the Age of Empires individual-versus-opposing-average rule, optionally
   normalized into a fixed zero-sum Side pot, for asymmetric partner changes.
3. Preserve `winner gains / loser loses`; use Set Scores as a capped
   sign-preserving intensity multiplier, with Simple Result as a
   low-information baseline that cannot be exploited by hiding a close score.
4. Keep one shared singles/doubles Rating unless actual singles usage warrants
   a separate ladder.
5. Treat an unjoined fourth participant as a real Not Joined Player and use a
   short, visible provisional phase rather than a shared guest.
6. Keep uncertainty lightweight: first few matches move the provisional Player
   more and protect established Players. Avoid full Glicko/TrueSkill complexity
   unless prediction quality later becomes the primary product goal.
7. Consider a separate streak/upset/season-points layer if the skill Rating is
   still not playful enough after the transparent Elo changes.

## Adopted outcome

The grill resolved every branch above:

- real responsiveness, calibrated to `±25` for a balanced Established Simple
  Result;
- raw independent per-Player Elo against the opposing Side mean, accepting a
  non-conserved Rating Pool;
- winner always gains and loser always loses;
- Set Scores add a linear, sign-preserving dominance bonus up to `1.4`;
- one shared singles/doubles Rating;
- three placement Matches on a K taper, affecting only the placing Player's own
  factor while Established Players remain at `K = 50`;
- integer changes with a floor of 1 and no ceiling;
- one-off Guests are match-scoped, doubles-only, and use the participating
  Players' mean as a hidden one-Match Rating input.

A follow-up calibration review (spec decisions 119–123) revised two of these
after the fact. The `±50` per-Match cap was removed: calibrated against an
earlier `K = 100`, it survived the reduction to `K = 70` without its rationale
and flattened exactly the upsets and shutouts this model exists to distinguish.
The flat Provisional `K` became the taper `max(50, 80 − 10n)`, removing the
perceptible cliff between a Player's third and fourth rated Match. Dominance
also gained a set-margin weight, because a games-only ratio rated a win that
dropped a set above a straight-sets win.

The exact formula, validation rules, Guest boundary, migration, and
presentation semantics live in the authoritative spec rather than this
research note.
