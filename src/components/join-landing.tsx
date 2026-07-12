"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { bindDevice } from "@/app/actions/binding";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {status === "failed"
              ? "Something went wrong"
              : `Hi ${playerName}! 👋`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {status === "binding" && <p>Linking this device to you…</p>}
          {status === "bound" && (
            <p>
              This device is now yours: matches you log will be credited to{" "}
              <span className="font-medium text-foreground">{playerName}</span>.
            </p>
          )}
          {status === "failed" && (
            <p>
              Couldn&apos;t link this device. Reload to try again, or ask the
              group admin for a fresh link.
            </p>
          )}
          {status === "bound" && showInstallHint && (
            <p className="rounded-md bg-muted p-3">
              <span className="font-medium text-foreground">
                Add it to your home screen:
              </span>{" "}
              tap the share button in Safari, then{" "}
              <span className="font-medium text-foreground">
                Add to Home Screen
              </span>
              . The app opens full-screen and keeps you signed in.
            </p>
          )}
        </CardContent>
        {status === "bound" && (
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/">Open PadelClash</Link>
            </Button>
          </CardFooter>
        )}
      </Card>
    </main>
  );
}
