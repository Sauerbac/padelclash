"use client";

import { useState, useTransition } from "react";
import {
  deletePlayerAction,
  generatePersonalLinkAction,
  renamePlayerAction,
  restorePlayerAction,
  retirePlayerAction,
  revokeAccessAction,
  revokePersonalLinkAction,
  type AdminResult,
} from "@/app/actions/admin";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { Input } from "@/components/ui/input";
import type { RosterEntry } from "@/services/players";

/**
 * One roster row, with the controls its state earns (spec decision 50):
 * Joined rows manage a live binding, Not Joined rows manage an invitation,
 * Retired rows offer restore. Conditional delete appears wherever the match
 * log doesn't reference the Player.
 */
export function PlayerRow({ entry }: { entry: RosterEntry }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<AdminResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <li className="border px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <form
          action={(formData) =>
            run(async () => {
              const state = await renamePlayerAction({}, formData);
              return state.error
                ? { ok: false, error: state.error }
                : { ok: true };
            })
          }
          className="flex flex-1 items-center gap-2"
        >
          <input type="hidden" name="playerId" value={entry.id} />
          <Input
            name="name"
            defaultValue={entry.name}
            aria-label={`Name of ${entry.name}`}
            className="h-10 text-base uppercase"
          />
          <Button type="submit" variant="outline" size="sm" className="text-xs">
            Rename
          </Button>
        </form>
        {entry.status === "retired" && <Badge variant="retired">Retired</Badge>}
      </div>

      {entry.binding && (
        <p className="mt-1.5 font-mono text-xs font-medium text-muted-foreground">
          joined {formatDate(entry.binding.createdAt)} · last seen{" "}
          {formatDate(entry.binding.lastSeenAt)}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {entry.personalLink && (
          <CopyLinkButton
            path={`/join/${entry.personalLink.token}`}
            label="Copy invite"
          />
        )}

        {entry.status !== "retired" && (
          <ConfirmDialog
            trigger={
              <Button variant="chip" size="xs" disabled={pending}>
                {entry.status === "joined"
                  ? "Replace device"
                  : entry.personalLink
                    ? "New invite"
                    : "Invite"}
              </Button>
            }
            title={
              entry.status === "joined"
                ? `Replace ${entry.name}'s device?`
                : `Invite ${entry.name}?`
            }
            description={
              entry.status === "joined"
                ? "Their current device keeps working until the new link is used, then loses access."
                : "Creates a single-use link that expires in 7 days. Any previous link stops working."
            }
            confirmLabel="Generate link"
            onConfirm={() =>
              run(async () => generatePersonalLinkAction(entry.id))
            }
          />
        )}

        {entry.personalLink && (
          <Button
            variant="chip"
            size="xs"
            disabled={pending}
            onClick={() => run(() => revokePersonalLinkAction(entry.id))}
          >
            Revoke invite
          </Button>
        )}

        {entry.status === "joined" && (
          <ConfirmDialog
            trigger={
              <Button variant="destructive" size="xs" disabled={pending}>
                Revoke access
              </Button>
            }
            title={`Revoke ${entry.name}'s access?`}
            description="Their device loses access immediately. Their outstanding invite and the circle's General Link are revoked too, so nobody can walk straight back in."
            confirmLabel="Revoke"
            onConfirm={() => run(() => revokeAccessAction(entry.id))}
          />
        )}

        {entry.status === "retired" ? (
          <Button
            variant="chip"
            size="xs"
            disabled={pending}
            onClick={() => run(() => restorePlayerAction(entry.id))}
          >
            Restore
          </Button>
        ) : (
          <ConfirmDialog
            trigger={
              <Button variant="destructive" size="xs" disabled={pending}>
                Retire
              </Button>
            }
            title={`Retire ${entry.name}?`}
            description="They leave the pickers and lose access; their match history stays."
            confirmLabel="Retire"
            onConfirm={() => run(() => retirePlayerAction(entry.id))}
          />
        )}

        {entry.deletable && (
          <ConfirmDialog
            trigger={
              <Button variant="destructive" size="xs" disabled={pending}>
                Delete
              </Button>
            }
            title={`Delete ${entry.name} for good?`}
            description="No match references them, so nothing is lost — but this can't be undone."
            confirmLabel="Delete"
            onConfirm={() => run(() => deletePlayerAction(entry.id))}
          />
        )}
      </div>

      {error && (
        <div className="mt-2.5">
          <Alert variant="destructive">{error}</Alert>
        </div>
      )}
    </li>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(date: Date): string {
  return dateFormat.format(new Date(date));
}
