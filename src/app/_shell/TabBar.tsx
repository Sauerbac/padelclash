"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// App-shell navigation chrome. It lives in the `app` layer — not `src/ui` —
// because it is inherently route-aware (Link + usePathname). It is *composed
// from* the design tokens, keeping the ui fence strict (binding §2).

type Tab = { href: string; label: string; icon: ReactNode };

const TABS: Tab[] = [
  {
    href: "/",
    label: "Board",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 9h12M6 9a4 4 0 0 1-4-4h4m12 4a4 4 0 0 0 4-4h-4M9 9v4a3 3 0 0 0 6 0V9M9 4h6v5H9zM10 20h4M12 16v4" />
      </svg>
    ),
  },
  {
    href: "/log",
    label: "Log",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Me",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t-2 border-ink bg-surface"
    >
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 " +
              (active ? "text-primary" : "text-secondary")
            }
          >
            {tab.icon}
            <span className="font-mono text-meta font-bold uppercase tracking-wide">
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
