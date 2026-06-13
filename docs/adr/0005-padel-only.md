# Padel only — multi-sport support is rejected, not deferred

Decided by Simon, 2026-06-12: PadelClash supports padel and nothing else. The former multi-sport feature and all its design allowances (a sport attribute on Group, sport templates, sport-agnostic abstractions) are removed entirely — not parked for later.

Recorded because the temptation will recur: the mechanics (matches, Elo, groups, tournaments) genuinely are sport-agnostic, and someone will suggest tennis or table-tennis support again. The rejection is a product-identity decision, not a technical one — every generalization for "any sport" taxes every padel feature, and the app's personality (Americano, partner chemistry, court sides) is padel through and through.

## Consequences

- No `sport` field anywhere in the data model.
- The three result formats (ADR-0003) exist for padel's own needs — sets, Americano points, quick winner — not as a multi-sport extension point.
- The name is PadelClash, with no umbrella-sport escape hatch needed in the branding.
