"use client";

import { useEffect, useState } from "react";
import { TabShell } from "@/components/tab-shell";
import { PrivateFallbackContent } from "@/components/private-fallback-content";

export function OfflineRoute() {
  const [pathname] = useState<string | undefined>(() =>
    typeof window === "undefined" ? undefined : window.location.pathname,
  );
  useEffect(() => {
    const recover = () => window.location.reload();
    const recoverLateNavigation = (event: MessageEvent) => {
      if (
        event.data?.type === "navigation-ready" &&
        event.data.pathname === window.location.pathname
      ) {
        recover();
      }
    };
    window.addEventListener("online", recover);
    navigator.serviceWorker?.addEventListener("message", recoverLateNavigation);
    return () => {
      window.removeEventListener("online", recover);
      navigator.serviceWorker?.removeEventListener("message", recoverLateNavigation);
    };
  }, []);

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
