"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
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
      size="sm"
      aria-label="Back"
      className="-ml-2"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push("/");
      }}
    >
      <ChevronLeft aria-hidden />
      Back
    </Button>
  );
}
