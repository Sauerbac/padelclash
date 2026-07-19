"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Pencil, X } from "lucide-react";
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

  return (
    <div className="flex gap-1">
      <Button asChild variant="ghost" size="icon-xs" aria-label="Edit match">
        <Link href={`/matches/${matchId}/edit`}>
          <Pencil aria-hidden />
        </Link>
      </Button>
      <ConfirmDialog
        trigger={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Delete match"
            disabled={pending}
          >
            <X aria-hidden />
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
