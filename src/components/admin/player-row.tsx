"use client";

import { useState, useTransition } from "react";
import { ChevronDownIcon } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  CopyLinkButton,
  copyInvitationLink,
} from "@/components/admin/copy-link-button";
import { Input } from "@/components/ui/input";
import type { RosterEntry } from "@/services/players";

export interface PlayerRowActions {
  rename?: typeof renamePlayerAction;
  generatePersonalLink?: typeof generatePersonalLinkAction;
  revokePersonalLink?: typeof revokePersonalLinkAction;
  revokeAccess?: typeof revokeAccessAction;
  retire?: typeof retirePlayerAction;
  restore?: typeof restorePlayerAction;
  deletePlayer?: typeof deletePlayerAction;
  getBindingHistory?: typeof getBindingHistoryAction;
}

type PlayerRowProps = {
  entry: RosterEntry;
  onDeleted: (playerId: string) => void;
  /** Gallery stubs; production uses the imported server actions. */
  actions?: PlayerRowActions;
} & (
  | { collapsible: false; expanded?: never; onToggle?: never }
  | { collapsible?: true; expanded: boolean; onToggle: () => void }
);

/**
 * One roster row, with the controls its state earns (spec decision 50):
 * Joined rows manage a live binding, Not Joined rows manage an invitation,
 * Retired rows offer restore. Conditional delete appears wherever the match
 * log doesn't reference the Player.
 */
export function PlayerRow(props: PlayerRowProps) {
  const { entry, onDeleted, actions } = props;
  const collapsible = props.collapsible !== false;
  const expanded = props.collapsible === false ? true : props.expanded;
  const rename = actions?.rename ?? renamePlayerAction;
  const generatePersonalLink =
    actions?.generatePersonalLink ?? generatePersonalLinkAction;
  const revokePersonalLink =
    actions?.revokePersonalLink ?? revokePersonalLinkAction;
  const revokePlayerAccess = actions?.revokeAccess ?? revokeAccessAction;
  const retire = actions?.retire ?? retirePlayerAction;
  const restore = actions?.restore ?? restorePlayerAction;
  const deletePlayer = actions?.deletePlayer ?? deletePlayerAction;
  const getBindingHistory =
    actions?.getBindingHistory ?? getBindingHistoryAction;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<AdminResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  function generateInvite() {
    setError(null);
    startTransition(async () => {
      const result = await generatePersonalLink(entry.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await copyInvitationLink(`/join/${result.link.token}`);
    });
  }

  const panelId = `player-panel-${entry.id}`;

  return (
    <li className="overflow-hidden border">
      {collapsible ? (
        <Button
          type="button"
          variant="ghost"
          size="default"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={props.onToggle}
          className="min-h-11 w-full min-w-0 justify-between gap-3 px-3.5 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="min-w-0 truncate text-base font-semibold uppercase">
            {entry.name}
          </span>
          <ChevronDownIcon
            aria-hidden
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </Button>
      ) : (
        <div className="px-3.5 py-2.5 text-base font-semibold uppercase">
          {entry.name}
        </div>
      )}

      <div
        id={panelId}
        hidden={collapsible && !expanded}
        aria-hidden={collapsible && !expanded}
        className="border-t px-3.5 pt-3 pb-3.5"
      >
          <form
            action={(formData) =>
              run(async () => {
                const state = await rename({}, formData);
                return state.error
                  ? { ok: false, error: state.error }
                  : { ok: true };
              })
            }
            className="flex min-w-0 items-center gap-2"
          >
            <input type="hidden" name="playerId" value={entry.id} />
            <Input
              name="name"
              defaultValue={entry.name}
              aria-label={`Name of ${entry.name}`}
              disabled={pending}
              className="h-10 min-w-0 text-base uppercase"
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={pending}
              data-admin-action="rename"
              className="shrink-0 text-xs"
            >
              Rename
            </Button>
          </form>

          {/* What Admin gets to know about a device (spec decision 53): when it
              was bound and when it last checked in — enough to answer "is this
              still the phone they're using?" — and nothing that identifies the
              hardware itself. */}
          {entry.binding && (
            <p className="mt-2 font-mono text-xs font-medium text-muted-foreground">
              joined {formatDate(entry.binding.createdAt)} · last seen{" "}
              {formatDate(entry.binding.lastSeenAt)}
            </p>
          )}
          {entry.personalLink && (
            <p className="mt-1 font-mono text-xs font-medium text-accent">
              invite valid until {formatDate(entry.personalLink.expiresAt)}
            </p>
          )}

          <BindingHistory
            playerId={entry.id}
            name={entry.name}
            getBindingHistory={getBindingHistory}
          />

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
                onConfirm={generateInvite}
              />
            )}

            {entry.personalLink && (
              <Button
                variant="chip"
                size="xs"
                disabled={pending}
                onClick={() => run(() => revokePersonalLink(entry.id))}
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
                onConfirm={() => run(() => revokePlayerAccess(entry.id))}
              />
            )}

            {entry.status === "retired" ? (
              <Button
                variant="chip"
                size="xs"
                disabled={pending}
                onClick={() => run(() => restore(entry.id))}
              >
                Restore
              </Button>
            ) : (
              <ConfirmDialog
                trigger={
                  <Button
                    variant="destructive"
                    size="xs"
                    disabled={pending}
                    data-admin-action="retire"
                  >
                    Retire
                  </Button>
                }
                title={`Retire ${entry.name}?`}
                description="They leave the pickers and lose access; their match history stays."
                confirmLabel="Retire"
                onConfirm={() => run(() => retire(entry.id))}
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
                onConfirm={() =>
                  run(async () => {
                    const result = await deletePlayer(entry.id);
                    if (result.ok) onDeleted(entry.id);
                    return result;
                  })
                }
              />
            )}
          </div>

          {error && (
            <div className="mt-2.5">
              <Alert variant="destructive">{error}</Alert>
            </div>
          )}
      </div>
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
function BindingHistory({
  playerId,
  name,
  getBindingHistory,
}: {
  playerId: string;
  name: string;
  getBindingHistory: typeof getBindingHistoryAction;
}) {
  const [records, setRecords] = useState<BindingRecord[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, startTransition] = useTransition();

  function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    if (records) return;
    startTransition(async () => setRecords(await getBindingHistory(playerId)));
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
