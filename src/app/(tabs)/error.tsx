"use client";

import { PrivateRouteError } from "@/components/private-route-error";

export default function Error({ reset }: { error: Error; reset(): void }) {
  return <PrivateRouteError reset={reset} />;
}
