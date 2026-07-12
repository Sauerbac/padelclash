"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteMatchAction } from "@/app/actions/matches";
import { Button } from "@/components/ui/button";

/**
 * Edit/delete affordances on a feed card. Only rendered when the viewer has
 * edit rights (the server decides); the actions re-check server-side.
 */
export function MatchCardActions({ matchId }: { matchId: string }) {
  const [pending, startTransition] = useTransition();

  function remove() {
    if (
      !window.confirm(
        "Delete this match? Ratings are recomputed as if it was never played.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteMatchAction(matchId);
      // revalidatePath in the action refreshes the feed on success.
      if (!result.ok) window.alert(result.error);
    });
  }

  return (
    <div className="flex gap-1">
      <Button asChild variant="ghost" size="sm" aria-label="Edit match">
        <Link href={`/matches/${matchId}/edit`}>
          <Pencil aria-hidden />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Delete match"
        onClick={remove}
        disabled={pending}
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}
