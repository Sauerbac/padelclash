# Current focus: secure onboarding and device binding

- Replace convenience-grade player cookies with one server-managed Device Binding per Player.
- Keep Device Bindings valid indefinitely until Admin revokes/replaces them or the Player is retired; normal use refreshes the client credential.
- Do not offer Player-facing logout, unbind, or identity switching; only Admin can deliberately end a Device Binding.
- Admin can replace or revoke a Device Binding; changing devices or recovering from lost storage requires Admin involvement.
- Admin “Revoke access” invalidates both the Device Binding and any outstanding Personal Onboarding Link; “Replace device” leaves the current binding valid until its link is used.
- Emergency Player revocation also revokes the active General Onboarding Link so it cannot immediately be used to reclaim the Player.
- Organize Admin into Joined Players, Not Joined Players, and Retired Players.
- Add a temporary, secret General Onboarding Link that expires after 12 hours and that Admin can revoke early.
- Allow only one General Onboarding Link at a time; Admin can copy it while valid and generate a new one only after expiry or revocation.
- The General Onboarding Link lists only Not Joined Players and also lets an attendee create a uniquely named Player and join immediately.
- General Onboarding requires confirmation after selecting or naming a Player, warning that the installation cannot switch without Admin; creation and binding happen only on confirmation after atomic revalidation.
- Any successful join invalidates that Player’s outstanding Personal Onboarding Link, including a join completed through the General Onboarding Link.
- Add a single-use, revocable Personal Onboarding Link that expires after 7 days. For device replacement, the existing binding remains valid until the replacement link is used, then is revoked.
- Allow at most one valid Personal Onboarding Link per Player; Admin can recopy it while valid or replace it to revoke the old link and restart the 7-day window.
- Generate Personal Onboarding Links only when Admin requests one; creating a Player leaves them Not Joined with no dormant invitation.
- Personal Onboarding requires an explicit “Join as {Player}” confirmation; opening or previewing the link never consumes it or changes bindings.
- Onboarding links cannot switch an already-bound installation; they redirect it to `/` without consuming the link or changing a binding.
- Player Names are case-insensitively unique across the full roster, including Retired Players; Admin can rename Players.
- Admin can permanently delete a Player only when no existing Match references them as participant or Logger; onboarding and browsing do not block deletion, and removing all referencing Matches makes them deletable again.
- Admin can restore a Retired Player to Not Joined; restoration preserves history and name but never restores an old Device Binding.
- Replace the ordinary app for unbound visitors with a dedicated Not Joined screen; Feed, Log Match, Rankings, Player Detail, and other player-facing data require a valid Device Binding.
- Preserve group trust after onboarding: any Joined Player can log a match for any roster participants; the Logger need not participate.
- Store only hashed, unguessable Device Binding credentials; send them solely in secure HttpOnly cookies and never use Player ids, invitation tokens, or localStorage as credentials.
- Validate every player-facing read and mutation on the server. Admin may bypass read gating and edit/delete without a Player binding, but logging still requires a bound Player Logger.
- Make onboarding confirmation transactional and race-safe across link validity, Player availability, normalized-name uniqueness, invitation consumption, and binding replacement.
- Tie offline queued Matches to their originating Player; never sync them under a different binding identity. Clear invalid credentials and private page caches when revocation is observed online.
- Show Logger attribution and binding creation/last-seen timestamps to Admin; retain revoked binding history without adding physical-device fingerprinting or a general activity log.
- Normalize Player Names for Unicode compatibility and whitespace before enforcing case-insensitive database uniqueness while preserving display casing.
- On rollout, invalidate legacy Player-id cookies and reusable links, start existing Players as Not Joined, create no General Link automatically, and rate-limit onboarding and Match mutations.

# Deferred

- Fix navbar shifting when no section is active (the red band vanishes).
- Add a shadow above the navbar so content and navigation remain visually separate.
- Add a Now button beside the Played At date picker.
- Give feed item time and points separate rows; variable card heights are acceptable.
- Remove the number beside the last chart point on Player Detail.
- Remove the Player Detail back button.

# Excluded / do not touch

- Add a Top 3 stand to Rankings.
