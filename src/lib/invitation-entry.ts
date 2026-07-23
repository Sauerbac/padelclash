const INVITATION_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export type InvitationDestination =
  | { ok: true; href: `/join/${string}` }
  | { ok: false; message: string };

export function invitationDestination(
  input: string,
  currentOrigin: string,
): InvitationDestination {
  const candidate = input.trim();
  if (candidate === "") {
    return {
      ok: false,
      message: "Paste the full invite link or invitation token.",
    };
  }

  if (INVITATION_TOKEN.test(candidate)) {
    return { ok: true, href: `/join/${candidate}` };
  }

  let invitationUrl: URL;
  try {
    invitationUrl = new URL(candidate);
  } catch {
    return {
      ok: false,
      message: "That invitation token doesn't look complete.",
    };
  }

  if (invitationUrl.origin !== currentOrigin) {
    return {
      ok: false,
      message: "That invite belongs to a different site.",
    };
  }

  const match = invitationUrl.pathname.match(
    /^\/join\/([A-Za-z0-9_-]{43})\/?$/,
  );
  if (!match) {
    return {
      ok: false,
      message: "Paste a PadelClash invite link ending in /join/…",
    };
  }

  return { ok: true, href: `/join/${match[1]}` };
}
