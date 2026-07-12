"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { bindDevice } from "@/app/actions/binding";
import {
  clearBindingToken,
  readBindingToken,
} from "@/lib/binding-storage";

/**
 * Silent binding repair: if the binding cookie is gone (iOS storage eviction)
 * but the localStorage token survived, re-bind with it. Skipped on /join
 * pages, where an explicit (possibly different) binding is in progress.
 *
 * Known small race: on an unbound page this fires immediately, while the user
 * could tap the name picker within the same round trip; whichever bind lands
 * last wins. Accepted — it needs an evicted cookie plus a live marker plus a
 * sub-second tap, and the page refresh makes the outcome visible either way.
 */
export function BindingRecovery({ isBound }: { isBound: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isBound || pathname.startsWith("/join/")) return;
    const token = readBindingToken();
    if (!token) return;

    let cancelled = false;
    bindDevice(token)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          router.refresh();
        } else {
          // Token was rotated or the player retired — the marker is dead.
          clearBindingToken();
        }
      })
      .catch(() => {
        // Offline or server unreachable — keep the marker, retry next open.
      });
    return () => {
      cancelled = true;
    };
  }, [isBound, pathname, router]);

  return null;
}
