"use client";

import { usePathname } from "next/navigation";
import { PrivateFallbackContent } from "@/components/private-fallback-content";

export function PrivateRouteError({ reset }: { reset(): void }) {
  const pathname = usePathname();
  return <PrivateFallbackContent pathname={pathname} reset={reset} />;
}
