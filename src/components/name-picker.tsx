"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bindByName } from "@/app/actions/binding";
import { Button } from "@/components/ui/button";
import { writeBindingToken } from "@/lib/binding-storage";

type RosterEntry = { id: string; name: string };

export function NamePicker({ roster }: { roster: RosterEntry[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function pick(player: RosterEntry) {
    if (!window.confirm(`Bind this device to ${player.name}?`)) return;
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
          <Button
            key={player.id}
            variant="outline"
            disabled={pending}
            onClick={() => pick(player)}
          >
            {player.name}
          </Button>
        ))}
      </div>
      {failed && (
        <p className="text-sm text-destructive">
          That didn&apos;t work — the picker may have been turned off. Reload
          and try again, or ask the admin for your join link.
        </p>
      )}
    </div>
  );
}
