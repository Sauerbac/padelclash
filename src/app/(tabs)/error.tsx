"use client";

import { PrivateRouteError } from "@/components/private-route-error";

export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry(): void }) {
  return <PrivateRouteError error={error} retry={unstable_retry} />;
}
