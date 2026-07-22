"use client";

import { useState, useTransition } from "react";
import {
  deletePlayerAction,
  generatePersonalLinkAction,
  getBindingHistoryAction,
  renamePlayerAction,
  restorePlayerAction,
  retirePlayerAction,
  revokeAccessAction,
  revokePersonalLinkAction,
  type AdminResult,
} from "@/app/actions/admin";
import type { BindingRecord } from "@/services/access";
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

      {/* What Admin gets to know about a device (spec decision 53): when it
          was bound and when it last checked in — enough to answer "is this
          still the phone they're using?" — and nothing that identifies the
          hardware itself. */}
      {entry.binding && (
        <p className="mt-1.5 font-mono text-xs font-medium text-muted-foreground">
          joined {formatDate(entry.binding.createdAt)} · last seen{" "}
          {formatDate(entry.binding.lastSeenAt)}
        </p>
      )}
      {entry.personalLink && (
        <p className="mt-1 font-mono text-xs font-medium text-accent">
          invite valid until {formatDate(entry.personalLink.expiresAt)}
        </p>
      )}

      <BindingHistory playerId={entry.id} name={entry.name} />

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

/**
 * The retained record of devices that were bound and stopped working (spec
 * decision 53) — the thing Admin needs when someone says "I lost my phone" or
 * "it stopped working last week" and nobody can remember what was done.
 *
 * Loaded on demand rather than with the roster: it is one query per Player,
 * consulted rarely, and irrelevant to the roster's usual job. Deliberately
 * hash-free — nothing shown here can be replayed as a credential.
 */
function BindingHistory({ playerId, name }: { playerId: string; name: string }) {
  const [records, setRecords] = useState<BindingRecord[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, startTransition] = useTransition();

  function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    if (records) return;
    startTransition(async () => setRecords(await getBindingHistoryAction(playerId)));
  }

  // Only past devices are news; the active one is already on the row above.
  const past = records?.filter((record) => !record.active) ?? [];

  return (
    <div className="mt-1.5">
      <Button
        variant="link"
        size="xs"
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="h-auto px-0 font-mono text-xs font-medium text-muted-foreground underline hover:text-foreground"
      >
        {open ? "Hide device history" : "Device history"}
      </Button>

      {open && (
        <div className="mt-1.5 border-l border-hairline pl-2.5">
          {loading && !records ? (
            <p className="font-mono text-xs font-medium text-muted-foreground">
              loading…
            </p>
          ) : past.length === 0 ? (
            <p className="font-mono text-xs font-medium text-muted-foreground">
              no previous devices for {name}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {past.map((record) => (
                <li
                  key={record.id}
                  className="font-mono text-xs font-medium text-muted-foreground"
                >
                  {formatDate(record.createdAt)} → {formatDate(record.lastSeenAt)}
                  {record.revokedAt && <> · ended {formatDate(record.revokedAt)}</>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
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
