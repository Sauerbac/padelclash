"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The bottom tab bar (design "TabBar + LogPlate"): FEED and RANKINGS as
 * letter-spaced text tabs, and the Log tab as a skewed primary-red plate
 * breaking out of the bar. Active text tab: 2px red top border + bright text.
 */
export function TabBar() {
  const pathname = usePathname();
  const feedActive = pathname === "/" || pathname.startsWith("/players") || pathname.startsWith("/matches");
  const logActive = pathname.startsWith("/log");
  const rankingsActive = pathname.startsWith("/leaderboard");

  // Every text tab reserves the active red band as a transparent border, so
  // switching sections changes colour only — never geometry (decision 68).
  // Without this the bar was 1px shorter on Log Match, where neither text tab
  // is active.
  const textTab = (active: boolean) =>
    cn(
      "-mt-px flex-1 border-t-2 pt-4 pb-3.5 text-center text-xs font-semibold tracking-[2px] uppercase",
      active
        ? "border-primary font-bold text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );

  return (
    // One drop shadow follows the silhouette of both the bar and its raised
    // Log plate, so the contour rises around the centre instead of becoming
    // two overlapping rectangular shadows (decision 72).
    <nav className="sticky bottom-0 z-40 border-t bg-plate pb-[env(safe-area-inset-bottom)] drop-shadow-[0_-5px_7px_rgba(0,0,0,0.9)]">
      <div className="mx-auto flex w-full max-w-lg">
        <Link
          href="/"
          aria-current={feedActive ? "page" : undefined}
          className={textTab(feedActive)}
        >
          Feed
        </Link>
        <div className="relative flex-1">
          <Link
            href="/log"
            aria-current={logActive ? "page" : undefined}
            aria-label="Log Match"
            className="absolute -top-3.5 left-1/2 -translate-x-1/2 skew-x-[-8deg] -rotate-2 border-b-[3px] border-accent bg-primary px-6.5 py-3 font-display text-base tracking-[1px] whitespace-nowrap text-primary-foreground uppercase"
          >
            Log
          </Link>
        </div>
        <Link
          href="/leaderboard"
          aria-current={rankingsActive ? "page" : undefined}
          className={textTab(rankingsActive)}
        >
          Rankings
        </Link>
      </div>
    </nav>
  );
}
