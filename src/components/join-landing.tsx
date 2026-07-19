"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { bindDevice } from "@/app/actions/binding";
import { Button } from "@/components/ui/button";
import { writeBindingToken } from "@/lib/binding-storage";

type Status = "binding" | "bound" | "failed";

export function JoinLanding({
  token,
  playerName,
}: {
  token: string;
  playerName: string;
}) {
  const [status, setStatus] = useState<Status>("binding");
  const [showInstallHint, setShowInstallHint] = useState(false);

  useEffect(() => {
    let cancelled = false;
    bindDevice(token)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          writeBindingToken(result.token);
          const ua = window.navigator.userAgent;
          // iPadOS 13+ Safari reports a desktop "Macintosh" UA by default;
          // touch support is the tell.
          const isIos =
            /iPhone|iPad|iPod/.test(ua) ||
            (ua.includes("Mac") && window.navigator.maxTouchPoints > 1);
          const isInstalled = window.matchMedia(
            "(display-mode: standalone)",
          ).matches;
          setShowInstallHint(isIos && !isInstalled);
          setStatus("bound");
        } else {
          setStatus("failed");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm border px-5 py-6">
        <p className="kicker">Welcome to the club</p>
        <h1 className="mt-2.5 font-display text-4xl leading-[1.1] uppercase">
          {status === "failed" ? "Something went wrong" : `Hi ${playerName}! 👋`}
        </h1>
        <div className="mt-3 text-base leading-normal font-semibold text-muted-foreground">
          {status === "binding" && <p>Linking this device to you…</p>}
          {status === "bound" && (
            <p>
              This device is now yours. Every match logged here gets credited
              to{" "}
              <span className="text-foreground uppercase">{playerName}</span>{" "}
              — wins and losses alike. Choose wisely.
            </p>
          )}
          {status === "failed" && (
            <p>
              Couldn&apos;t link this device. Reload to try again, or ask the
              group admin for a fresh link.
            </p>
          )}
        </div>
        {status === "bound" && showInstallHint && (
          <div className="mt-4 border px-3.5 py-3">
            <p className="text-xs font-bold tracking-[2px] text-accent uppercase">
              On iPhone?
            </p>
            <p className="mt-1 text-sm leading-snug font-semibold text-muted-foreground">
              Tap Share, then{" "}
              <span className="text-foreground">Add to Home Screen</span> to
              install the app. It opens full-screen and keeps you signed in.
            </p>
          </div>
        )}
        {status === "bound" && (
          <Button asChild className="mt-4 w-full">
            <Link href="/">Open PadelClash</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
