"use client";

import { useState } from "react";
import {
  renamePlayerAction,
  retirePlayerAction,
  rotateTokenAction,
} from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Destructive per-player action as a confirm-guarded one-button form.
function ConfirmActionForm({
  action,
  playerId,
  confirmMessage,
  variant,
  children,
}: {
  action: (formData: FormData) => void;
  playerId: string;
  confirmMessage: string;
  variant: "outline" | "ghost";
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <input type="hidden" name="playerId" value={playerId} />
      <Button type="submit" variant={variant} size="sm">
        {children}
      </Button>
    </form>
  );
}

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

  return (
    <li className="space-y-2 py-3">
      <form action={renamePlayerAction} className="flex items-center gap-2">
        <input type="hidden" name="playerId" value={playerId} />
        <Input
          name="name"
          defaultValue={name}
          aria-label={`Name of ${name}`}
          className="h-8"
          disabled={retired}
        />
        {retired ? (
          <Badge variant="secondary">Retired</Badge>
        ) : (
          <Button type="submit" variant="outline" size="sm">
            Rename
          </Button>
        )}
      </form>
      {!retired && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyJoinLink}>
            {copied ? "Copied!" : "Copy join link"}
          </Button>
          <ConfirmActionForm
            action={rotateTokenAction}
            playerId={playerId}
            variant="outline"
            confirmMessage={`Rotate ${name}'s join link? The old link stops working; already-bound devices stay bound.`}
          >
            Rotate link
          </ConfirmActionForm>
          <ConfirmActionForm
            action={retirePlayerAction}
            playerId={playerId}
            variant="ghost"
            confirmMessage={`Retire ${name}? They disappear from pickers and their devices unbind; their match history stays.`}
          >
            Retire
          </ConfirmActionForm>
        </div>
      )}
    </li>
  );
}
