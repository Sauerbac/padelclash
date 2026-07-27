# Use independent Player Elo for team Matches

Status: accepted

PadelClash calculates each Player's Elo expectation against the opposing Side's
mean instead of calculating one Side delta and splitting it. This Age of
Empires II-style rule directly rewards the lower-rated winner more and penalizes
the higher-rated loser more, while staying transparent enough for complete
historical replay. We rejected the old equal split, a normalized zero-sum Side
pot, and uncertainty-heavy TrueSkill/Glicko models because they either miss the
desired teammate asymmetry or add machinery the private circle does not need.

The deliberate consequences are that the Rating Pool may grow or shrink and
the independent expected scores do not form one canonical team win probability.
Set Score intensity, the placement K taper, Guest inputs, and rounding are
specified in `docs/padelclash-lite-spec.md`; the research comparison lives in
`docs/research/rating-systems.md`.

A per-Match change has no cap (decision 119). An upper bound would clip exactly
the results this decision exists to reward — the big upset and the shutout —
so K is left as the only bound. The teammate asymmetry above is therefore
continuous across the whole range rather than only in the middle of it.
