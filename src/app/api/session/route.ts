import { NextResponse } from "next/server";
import {
  BINDING_COOKIE,
  clearBindingCookie,
  currentBinding,
  refreshBindingCookie,
} from "@/services/auth/binding";
import { cookies } from "next/headers";

/**
 * "Am I still joined?" — the server contract behind decision 52.
 *
 * Revocation is authoritative on the server the instant Admin acts, but an
 * offline installation can only find out on its next contact. This is that
 * contact: a Route Handler (not a page) so it can actually clear the dead
 * cookie, which a Server Component may not do.
 *
 * The frontend tranche owns what happens next — dropping private page caches
 * and the IndexedDB queue's un-syncable items — but the authority for
 * "your credential is gone" is here.
 */
export interface SessionStatus {
  bound: boolean;
  bindingId: string | null;
  player: { id: string; name: string } | null;
  /**
   * True when this installation *presented* a credential that no longer
   * resolves — i.e. it was revoked, replaced, or its Player retired. The
   * distinction from a plain unbound visitor is what tells the client it has
   * caches and queued matches to clean up.
   */
  revoked: boolean;
}

export async function GET(): Promise<NextResponse<SessionStatus>> {
  const store = await cookies();
  const presented = store.has(BINDING_COOKIE);
  const binding = await currentBinding();

  if (binding) {
    // "Ordinary use refreshes the browser cookie" (spec "Device Binding").
    // This is the only surface that can deliver on that for a read-only
    // member: pages may not set cookies, and someone who reads the feed but
    // never logs a match would otherwise hit the browser's ~400-day cap and
    // silently lose access despite using the app daily. The frontend calls
    // this on app open anyway, for the revocation check below.
    await refreshBindingCookie();

    return noStore({
      bound: true,
      bindingId: binding.binding.id,
      player: { id: binding.player.id, name: binding.player.name },
      revoked: false,
    });
  }

  if (presented) await clearBindingCookie();

  return noStore({ bound: false, bindingId: null, player: null, revoked: presented });
}

// Never cacheable: a stale "you're fine" is precisely the failure this exists
// to prevent, and the service worker is told not to cache /api at all.
function noStore(status: SessionStatus): NextResponse<SessionStatus> {
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
