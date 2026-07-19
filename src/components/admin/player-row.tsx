"use client";

import { useState, useTransition } from "react";
import {
  renamePlayerAction,
  retirePlayerAction,
  rotateTokenAction,
} from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";

export function PlayerRow({
  playerId,
  name,
  personalToken,
  retired,
}: {
  playerId: string;
  name: string;
  personalToken: string;
  retired: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  async function copyJoinLink() {
    const link = `${window.location.origin}/join/${personalToken}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard needs HTTPS or localhost; show the link as a last resort.
      window.prompt("Copy the join link:", link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function act(action: (formData: FormData) => Promise<void> | void) {
    startTransition(() => {
      const data = new FormData();
      data.set("playerId", playerId);
      action(data);
    });
  }

  if (retired) {
    return (
      <li className="border border-hairline px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold text-muted-foreground/70 uppercase">
            {name}
          </span>
          <Badge variant="retired">Retired</Badge>
        </div>
      </li>
    );
  }

  return (
    <li className="border px-3.5 py-3">
      <form action={renamePlayerAction} className="flex items-center gap-2">
        <input type="hidden" name="playerId" value={playerId} />
        <Input
          name="name"
          defaultValue={name}
          aria-label={`Name of ${name}`}
          className="h-10 text-base uppercase"
        />
        <Button type="submit" variant="outline" size="sm" className="text-xs">
          Rename
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          variant="chip"
          size="xs"
          onClick={copyJoinLink}
          className={copied ? "border-accent text-accent" : undefined}
        >
          {copied ? "Copied!" : "Copy join link"}
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="chip" size="xs">
              Rotate link
            </Button>
          }
          title="Rotate this join link?"
          description={`${name}'s old link stops working; already-bound devices stay bound.`}
          confirmLabel="Rotate"
          onConfirm={() => act(rotateTokenAction)}
        />
        <ConfirmDialog
          trigger={
            <Button variant="destructive" size="xs">
              Retire
            </Button>
          }
          title={`Retire ${name}?`}
          description="They disappear from pickers and their devices unbind; their match history stays."
          confirmLabel="Retire"
          onConfirm={() => act(retirePlayerAction)}
        />
      </div>
    </li>
  );
}
