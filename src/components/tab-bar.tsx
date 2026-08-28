"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { TabTransitionFallback } from "@/components/tab-transition-fallback";

/**
 * The bottom tab bar (design "TabBar + LogPlate"): FEED and RANKINGS as
 * letter-spaced text tabs, and the Log tab as a skewed primary-red plate
 * breaking out of the bar. Active text tab: 2px red top border + bright text.
 */
export function TabBar({
  /**
   * Which route to light up, defaulting to the one actually being viewed.
   * Nothing in the app passes it; the gallery does, because a screen case
   * renders at `/dev/gallery/…` and would otherwise show a bar with no active
   * tab — a shell that lies about the screen under review (decision 127).
   */
  pathname: activePath,
}: {
  pathname?: string;
} = {}) {
  const currentPath = usePathname();
  const [pendingNavigation, setPendingNavigation] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const pendingPath =
    pendingNavigation?.from === currentPath ? pendingNavigation.to : null;
  const pathname = activePath ?? pendingPath ?? currentPath;
  const feedActive = pathname === "/" || pathname.startsWith("/players") || pathname.startsWith("/matches");
  const logActive = pathname.startsWith("/log");
  const rankingsActive = pathname.startsWith("/leaderboard");

  // Every text tab reserves the active red band as a transparent border, so
  // switching sections changes colour only — never geometry (decision 68).
  // Without this the bar was 1px shorter on Log Match, where neither text tab
  // is active.
  const textTab = (active: boolean) =>
    cn(
      "-mt-px flex-1 border-t-2 pt-4 pb-3.5 text-center text-sm font-semibold tracking-[2px] uppercase",
      active
        ? "border-primary font-bold text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );

  return (
    // One drop shadow follows the silhouette of both the bar and its raised
    // Log plate, so the contour rises around the centre instead of becoming
    // two overlapping rectangular shadows (decision 72).
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-plate pb-[env(safe-area-inset-bottom)] drop-shadow-[0_-5px_7px_rgba(0,0,0,0.9)]">
      <div className="mx-auto flex w-full max-w-lg">
        <Link
          href="/"
          onClick={() =>
            !activePath && setPendingNavigation({ from: currentPath, to: "/" })
          }
          aria-current={feedActive ? "page" : undefined}
          className={textTab(feedActive)}
        >
          Feed
          <TabTransitionFallback destination="feed" />
        </Link>
        <div className="relative flex-1">
          {feedActive && (
            <span
              aria-hidden
              className="absolute top-[-1px] right-1/2 left-0 h-0.5 bg-primary"
            />
          )}
          {rankingsActive && (
            <span
              aria-hidden
              className="absolute top-[-1px] right-0 left-1/2 h-0.5 bg-primary"
            />
          )}
          <Link
            href="/log"
            onClick={() =>
              !activePath && setPendingNavigation({ from: currentPath, to: "/log" })
            }
            aria-current={logActive ? "page" : undefined}
            aria-label="Log Match"
            className="absolute -top-3.5 left-1/2 z-10 w-24 -translate-x-1/2 skew-x-[-8deg] -rotate-2 border-b-[3px] border-accent bg-primary py-3 text-center font-display text-base tracking-[1px] whitespace-nowrap text-primary-foreground uppercase"
          >
            Log
            <TabTransitionFallback destination="log" />
          </Link>
        </div>
        <Link
          href="/leaderboard"
          onClick={() =>
            !activePath &&
            setPendingNavigation({ from: currentPath, to: "/leaderboard" })
          }
          aria-current={rankingsActive ? "page" : undefined}
          className={textTab(rankingsActive)}
        >
          Rankings
          <TabTransitionFallback destination="leaderboard" />
        </Link>
      </div>
    </nav>
  );
}
