# Join / Bind Device

## Identity

- Route: `/join/:token`
- Entry point: personal link created by the admin and shared with a player
- Main implementation: `src/app/join/[token]/page.tsx`,
  `src/components/join-landing.tsx`

## Purpose

Bind the current browser/device to a specific active player. The token in the
URL identifies the player; there is no player-selection step on a valid join
link and no password form.

## Current structural layout

The page is a vertically and horizontally centered single card. It is a
standalone surface: it does not show the main tab bar, feed, or admin controls.

## Binding lifecycle

The page attempts to bind automatically when it loads. The user does not press
a “bind” button.

### Binding in progress

- Heading greets the player: `Hi [player name]! 👋`.
- Body says `Linking this device to you…`.
- The card has no action button while the request is in progress.

### Bound successfully

- Keep the greeting heading.
- Explain that the device is now assigned to the named player and that matches
  logged from it will be credited to them.
- On iOS Safari when the app is not already installed as a standalone PWA,
  show an install hint explaining the Share button and `Add to Home Screen`.
- Show a full-width `Open PadelClash` action linking to `/`.

The server writes the long-lived device binding. The client also stores a local
recovery marker so the binding can be restored after cookie eviction.

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

- A personal link is reusable and can bind a new or forgetful device.
- The admin can rotate a token. The old URL then stops working.
- Rotating a token does not unbind devices that are already bound.
- Retiring a player revokes their link and removes their active binding.

