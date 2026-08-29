"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { TabShell } from "@/components/tab-shell";
import { PrivateFallbackContent } from "@/components/private-fallback-content";

export function OfflineRoute({ pathnamePreview }: { pathnamePreview?: string } = {}) {
  const browserPathname = useSyncExternalStore(
    subscribePathname,
    () => window.location.pathname,
    () => undefined,
  );
  const pathname = pathnamePreview ?? browserPathname;
  const recovering = useRef(false);
  useEffect(() => {
    if (pathnamePreview) return;
    const requestRecoveryStatus = () => navigator.serviceWorker?.controller?.postMessage({
      type: "navigation-status",
      pathname: window.location.pathname,
    });
    const recoverLateNavigation = (event: MessageEvent) => {
      if (
        event.data?.type === "navigation-ready" &&
        event.data.pathname === window.location.pathname &&
        !recovering.current
      ) {
        recovering.current = true;
        // The worker has durably cached this exact successful navigation. A
        // single controlled reload consumes that response, so recovery still
        // succeeds if connectivity disappears after the original request.
        window.location.reload();
      }
    };
    requestRecoveryStatus();
    window.addEventListener("online", requestRecoveryStatus);
    navigator.serviceWorker?.addEventListener("message", recoverLateNavigation);
    return () => {
      window.removeEventListener("online", requestRecoveryStatus);
      navigator.serviceWorker?.removeEventListener("message", recoverLateNavigation);
    };
  }, [pathnamePreview]);

  if (pathname === undefined) {
    return <p role="status" className="p-5 font-semibold text-muted-foreground">Opening PadelClash…</p>;
  }
  const activePath = pathname === "/offline" ? "/log" : pathname;
  return (
    <TabShell pathname={activePath}>
      <PrivateFallbackContent pathname={pathname} />
    </TabShell>
  );
}

function subscribePathname(): () => void {
  return () => undefined;
}
