# Join / Bind Device

## Identity

- Route: `/join/:token`
- Entry point: Personal or General Onboarding Link created by Admin
- Main implementation: `src/app/join/[token]/page.tsx`,
  `src/components/join-confirm.tsx`

## Purpose

Create or replace the installation's Device Binding after explicit
confirmation. A Personal Link identifies one Player. A General Link allows the
visitor to select a Not Joined Player or create a new Player.

## Current structural layout

The page is a vertically and horizontally centered single card. It is a
standalone surface: it does not show the main tab bar, feed, or admin controls.

## Binding lifecycle

Opening or previewing a link never mutates state. The page explains that this
installation cannot switch Players without Admin help and requires an explicit
confirmation. Confirmation revalidates the invitation, Player, Player Name and
current installation state atomically.

### Bound successfully

- The server writes the long-lived, HttpOnly Device Binding cookie and stores
  only its hash in PostgreSQL.
- A Personal Link is consumed. Any outstanding Personal Link for a Player
  joined through a General Link is invalidated.
- The installation opens PadelClash as that Player. No credential or recovery
  marker is written to localStorage.

### Binding failed

- Change the heading to `Something went wrong`.
- Explain that the device could not be linked.
- Suggest reloading or asking the admin for a fresh link.
- There is no custom retry control; reload is the retry mechanism.

### Invalid or revoked link

The server refuses unknown tokens and tokens for retired players. Render a
standalone error card:

- Title: `This link doesn’t work`.
- Body: the invite link is invalid or has been replaced; ask the admin for a
  fresh one.

No binding attempt is made and no tab bar is shown.

## Token behavior relevant to redesign

- Personal Links are single-use, expire after 7 days, and are replaced when
  Admin issues another.
- The General Link may onboard several Players during its 12-hour lifetime.
- A bound installation is redirected away from onboarding without consuming
  the invitation.
- Replacing or revoking access and retiring a Player invalidate the active
  Device Binding according to the source-of-truth spec.
