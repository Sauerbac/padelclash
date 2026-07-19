"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bindByName } from "@/app/actions/binding";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { writeBindingToken } from "@/lib/binding-storage";

type RosterEntry = { id: string; name: string };

export function NamePicker({ roster }: { roster: RosterEntry[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function pick(player: RosterEntry) {
    startTransition(async () => {
      const result = await bindByName(player.id);
      if (result) {
        // Same recovery marker as the join-link path, so picker-bound
        // devices also survive iOS cookie eviction.
        writeBindingToken(result.token);
        router.refresh();
      } else {
        setFailed(true);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {roster.map((player) => (
          <ConfirmDialog
            key={player.id}
            trigger={
              <Button variant="outline" size="sm" disabled={pending}>
                {player.name}
              </Button>
            }
            title={`Bind this device to ${player.name}?`}
            description="Every match logged from this device gets credited to them — wins and losses alike. Choose wisely."
            cancelLabel="Not me"
            confirmLabel="That's me"
            onConfirm={() => pick(player)}
          />
        ))}
      </div>
      {failed && (
        <Alert variant="destructive">
          That didn&apos;t work — the picker may have been turned off. Reload
          and try again, or ask the admin for your join link.
        </Alert>
      )}
    </div>
  );
}
