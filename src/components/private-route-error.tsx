"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function PrivateRouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry(): void;
}) {
  useEffect(() => {
    console.error("Private route render failed", error.digest ?? error.name);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 pt-6 pb-10">
      <section className="border p-5">
        <h1 className="font-display text-[30px] uppercase">Something went wrong</h1>
        <p className="mt-2 font-semibold text-muted-foreground">
          This page could not be loaded. Your locally saved matches have not been changed.
        </p>
        <Button className="mt-4 w-full" onClick={retry}>Try again</Button>
      </section>
    </main>
  );
}
