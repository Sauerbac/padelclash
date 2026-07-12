"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, SquarePlus, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Feed", icon: Home },
  { href: "/log", label: "Log Match", icon: SquarePlus },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
] as const;

/** The bottom tab bar of the three main screens (spec "Screens"). */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-lg">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
