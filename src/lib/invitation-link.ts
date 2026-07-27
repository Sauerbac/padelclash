/** Build the full same-site URL that can be shared outside the app. */
export function absoluteInvitationUrl(path: string, origin: string): string {
  return new URL(path, `${origin.replace(/\/+$/, "")}/`).toString();
}
