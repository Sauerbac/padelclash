"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CircleX, Pencil } from "lucide-react";
import { deleteMatchAction } from "@/app/actions/matches";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

/**
 * Edit/delete affordances on a feed card. Only rendered when the viewer has
 * edit rights (the server decides); the actions re-check server-side.
 */
export function MatchCardActions({ matchId }: { matchId: string }) {
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteMatchAction(matchId);
      // revalidatePath in the action refreshes the feed on success.
      if (!result.ok) window.alert(result.error);
    });
  }

  // 40px targets per the card design, pulled back into the meta row with a
  // negative margin so they don't set the row's height.
  const target = "size-10 -my-1.5";

  return (
    <div className="-mr-1.5 flex gap-0.5">
      <Button
        asChild
        variant="ghost"
        size="icon-xs"
        aria-label="Edit match"
        className={target}
      >
        <Link href={`/matches/${matchId}/edit`}>
          <Pencil aria-hidden className="size-4" />
        </Link>
      </Button>
      <ConfirmDialog
        trigger={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Delete match"
            disabled={pending}
            className={target}
          >
            <CircleX aria-hidden className="size-4" />
          </Button>
        }
        title="Delete this match?"
        description="Ratings will be recomputed as if it never happened. History is watching."
        confirmLabel="Delete"
        onConfirm={remove}
      />
    </div>
  );
}
