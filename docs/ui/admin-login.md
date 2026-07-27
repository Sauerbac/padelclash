# Admin Login

**States: [`/dev/gallery/admin`](../../src/app/dev/gallery/[section]/page.tsx)** —
initial login, wrong-password, missing-configuration and authenticated-panel
states.

## Identity

- Route: `/admin` when there is no valid admin session
- Main implementation: `src/app/admin/page.tsx`,
  `src/components/admin/admin-login.tsx`

## Purpose

Authenticate the single administrator. This is the only password-based screen
in the app. Players do not log in with accounts or passwords.

## Current structural layout

The page is a standalone centered login card with no main tab bar. It contains:

1. Card title: `Admin login`.
2. A password label and password input.
3. An inline error area, if authentication fails.
4. A full-width submit action.

The password field receives focus automatically and is required. There is no
username field, remember-me control, password reset flow, or secondary link.

## Interaction states

- Initial submit action: `Log in`.
- While the server action is pending: `Checking…`; the action is disabled.
- Wrong password: show `Wrong password` inline and keep the input available.
- Missing server configuration: show an inline message that admin login is not
  configured because `ADMIN_PASSWORD` is unset.
- Success: establish the admin session and refresh `/admin` into the Admin Panel.
