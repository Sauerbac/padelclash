"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Back affordance for drill-in pages — an installed iOS PWA has no browser
 * chrome, so the page must carry its own. Falls back to the feed on a deep
 * link with no history.
 */
export function BackButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="xs"
      aria-label="Back"
      className="-ml-2 text-[13px]"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push("/");
      }}
    >
      <span aria-hidden className="text-base leading-none">
        ‹
      </span>
      Back
    </Button>
  );
}
