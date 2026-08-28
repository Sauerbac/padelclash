"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CircleX, Pencil } from "lucide-react";
import {
  deleteMatchAction,
  type DeleteMatchActionResult,
} from "@/app/actions/matches";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useProlongedWrite } from "@/lib/use-prolonged-write";

/**
 * Edit/delete affordances on a feed card. Only rendered when the viewer has
 * edit rights (the server decides); the actions re-check server-side.
 */
export function MatchCardActions({
  matchId,
  /**
   * The delete action, defaulting to the real one. Nothing in the app passes
   * it (decision 127): the gallery does, because the pending and failed states
   * below live in `useTransition` and are unreachable from props. Do not
   * "clean up" this default into a required prop.
   */
  deleteMatch = deleteMatchAction,
  waitPreview,
}: {
  matchId: string;
  deleteMatch?: (matchId: string) => Promise<DeleteMatchActionResult>;
  /** Gallery-only prolonged delete state. */
  waitPreview?: "slow" | "uncertain";
}) {
  const [pending, startTransition] = useTransition();
  const { writeWait, begin: beginWriteWait, finish: finishWriteWait } = useProlongedWrite();
  const visibleWriteWait = waitPreview ?? writeWait;

  function remove() {
    startTransition(async () => {
      beginWriteWait();
      try {
        const result = await deleteMatch(matchId);
        finishWriteWait();
        // revalidatePath in the action refreshes the feed on success.
        if (!result.ok) window.alert(result.error);
      } catch {
        window.alert("The server could not be reached. The result is unknown; check the Feed before trying again.");
      } finally {
        finishWriteWait();
      }
    });
  }

  // 40px targets per the card design, pulled back into the meta row with a
  // negative margin so they don't set the row's height.
  const target = "size-10 -my-1.5";

  return (
    <div className="-mr-1.5 flex items-center gap-0.5">
      {visibleWriteWait !== "normal" && (
        <span role="status" aria-live="polite" className="mr-1 max-w-28 text-right font-mono text-[9px] leading-tight text-muted-foreground uppercase">
          Still waiting for the server…
          {visibleWriteWait === "uncertain" && (
            <Button type="button" variant="link" size="xs" className="block h-auto w-full p-0 text-[9px]" onClick={() => window.location.reload()}>
              Check result
            </Button>
          )}
        </span>
      )}
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
