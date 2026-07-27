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
Set Score intensity, provisional K, Guest inputs, rounding, and caps are
specified in `docs/padelclash-lite-spec.md`; the research comparison lives in
`docs/research/rating-systems.md`.
