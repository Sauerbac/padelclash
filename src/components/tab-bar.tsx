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

  const textTab = (active: boolean) =>
    cn(
      "flex-1 pt-4 pb-3.5 text-center text-xs font-semibold tracking-[2px] uppercase",
      active
        ? "-mt-px border-t-2 border-primary font-bold text-foreground"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <nav className="sticky bottom-0 z-40 border-t bg-plate pb-[env(safe-area-inset-bottom)]">
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
