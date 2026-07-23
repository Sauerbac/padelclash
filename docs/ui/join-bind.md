# Join / Bind Device

## Identity

- Route: `/join/:token`
- Entry points: Personal or General Onboarding Link created by Admin; pasted
  invitation on the Not Joined screen of an installed PWA
- Main implementation: `src/app/join/[token]/page.tsx`,
  `src/components/join-confirm.tsx`, `src/components/not-joined.tsx`

## Purpose

Create or replace the installation's Device Binding after explicit
confirmation. A Personal Link identifies one Player. A General Link allows the
visitor to select a Not Joined Player or create a new Player.

## Current structural layout

The page is a vertically and horizontally centered single card. It is a
standalone surface: it does not show the main tab bar, feed, or admin controls.

## Installed-PWA invitation entry

An installed PWA without a valid Device Binding exposes an invitation input on
its Not Joined screen. The expected paste is the complete same-site
`/join/{token}` URL. The raw existing 256-bit token is also accepted for
convenience; this is not a new short-code format.

Valid input navigates into the existing invitation preview and explicit
confirmation flow. Parsing the input must not preview, consume, or confirm the
invitation by itself. Invalid input receives a local, actionable validation
message and does not navigate.

This input is available on both iOS and Android. It is the reliable fallback
when a clicked link opens in a browser rather than in the already-installed
PWA, because successful confirmation must set the HttpOnly Device Binding
cookie in the storage context that will run the app.

## Browser guidance

When `/join/:token` is opened on iOS outside standalone display mode, show a
prominent but non-blocking guidance panel above the ordinary invitation UI.
The invitation preview, Player selection, and confirmation remain usable on
the same page.

The guidance gives two recovery paths for an already-installed but unbound
Home Screen app:

1. Preferred: copy the complete invitation, open the installed PadelClash app,
   and paste it into the Not Joined screen.
2. Fallback: open and accept the invitation in Safari, remove the old Home
   Screen app, then add PadelClash to the Home Screen again from Safari so the
   new installation can receive Safari's binding cookie.

Do not show Android users uninstall/reinstall instructions. Android retains
the ordinary join page; an installed PWA may capture the clicked in-scope link,
and the universal paste input covers cases where the default browser opens it
instead. A non-Safari iOS default browser must not be described as reliably
seeding a Safari-created Home Screen app.

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
