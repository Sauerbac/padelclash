"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  confirmJoinAction,
  type JoinConfirmation,
} from "@/app/actions/onboarding";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BINDING_CHANGED_EVENT } from "@/services/offline/queue";
import type { InvitationPreview } from "@/services/onboarding";

/**
 * The explicit confirmation both link kinds require (spec decisions 42 and 43).
 *
 * Three things here are load-bearing rather than cosmetic:
 *
 * - Nothing mutates until the visitor presses the final button. Rendering,
 *   refreshing, picking a name and changing their mind are all free; the link
 *   is spent only by an intentional act.
 * - The warning is mandatory copy. Binding this installation is the one thing
 *   the user cannot undo without going back to the Admin, so it is stated on
 *   the screen where they commit, not buried on the one before.
 * - The confirm button is disabled in flight. An unbound installation presents
 *   no credential, so the server has nothing to serialize two simultaneous
 *   confirmations on (decision 62) — two tabs confirming different Players
 *   through one General Link would both legitimately succeed and one would win
 *   the cookie. Every other race is closed server-side; this one is ours.
 */
export function JoinConfirm({
  token,
  preview,
}: {
  token: string;
  preview: InvitationPreview;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // General Link only: the Player picked or named, held until confirmation.
  // `null` means "still choosing" — the two-step the spec asks for.
  const [choice, setChoice] = useState<GeneralChoice | null>(null);

  function confirm(confirmation: JoinConfirmation) {
    setError(null);
    startTransition(async () => {
      const result = await confirmJoinAction(confirmation);
      if (result.ok) {
        // This installation now has a binding. Anything queued from before —
        // a device re-invited after losing access still holds its matches —
        // can be attempted again straight away.
        window.dispatchEvent(new Event(BINDING_CHANGED_EVENT));
        router.replace("/");
        router.refresh();
        return;
      }

      // Already bound: this is the double-submit / second-tab case, and it is
      // a redirect rather than an error because nothing went wrong — the
      // installation has a Player, which is what it was trying to get
      // (decision 38). The link stays unspent.
      if (result.error === "already-bound") {
        router.replace("/");
        router.refresh();
        return;
      }

      // Someone beat them to that Player, or took that name, between the
      // preview and the press. Send them back to the picker and re-read the
      // roster so the stale option disappears instead of failing twice.
      if (
        result.error === "player-already-joined" ||
        result.error === "name-taken"
      ) {
        setChoice(null);
        router.refresh();
      }

      setError(MESSAGES[result.error] ?? "Couldn't join. Ask the group admin.");
    });
  }

  const heading =
    preview.kind === "personal"
      ? `Join as ${preview.player.name}`
      : choice
        ? `Join as ${choice.name}`
        : "Who are you?";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10">
      <div className="border px-5 py-6">
        <div className="flex items-start justify-between gap-3">
          <p className="kicker">Welcome to the club</p>
          <Image
            src="/logo.svg"
            alt=""
            width={56}
            height={56}
            priority
            unoptimized
            className="-mt-1 shrink-0"
          />
        </div>
        <h1 className="mt-2.5 font-display text-[40px] leading-[1.05] uppercase">
          {heading}
        </h1>

        {preview.kind === "personal" ? (
          <>
            <Warning replacing={preview.replacesBinding} />
            <Button
              className="mt-5 w-full"
              disabled={pending}
              onClick={() => confirm({ via: "personal", token })}
            >
              {pending ? "Joining…" : `Join as ${preview.player.name}`}
            </Button>
          </>
        ) : choice ? (
          <>
            <Warning replacing={false} />
            <div className="mt-5 space-y-1.5">
              <Button
                className="w-full"
                disabled={pending}
                onClick={() =>
                  confirm(
                    choice.kind === "existing"
                      ? {
                          via: "general-existing",
                          token,
                          playerId: choice.playerId,
                        }
                      : { via: "general-new", token, name: choice.name },
                  )
                }
              >
                {pending
                  ? "Joining…"
                  : choice.kind === "existing"
                    ? `Yes, I'm ${choice.name}`
                    : `Join as ${choice.name}`}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() => {
                  setChoice(null);
                  setError(null);
                }}
              >
                Pick someone else
              </Button>
            </div>
          </>
        ) : (
          <GeneralPicker
            notJoined={preview.notJoined}
            disabled={pending}
            onChoose={(next) => {
              setError(null);
              setChoice(next);
            }}
          />
        )}

        {error && (
          <div className="mt-4">
            <Alert variant="destructive">{error}</Alert>
          </div>
        )}
      </div>
    </main>
  );
}

type GeneralChoice =
  | { kind: "existing"; playerId: string; name: string }
  | { kind: "new"; name: string };

/**
 * Step one of the General flow: pick an unclaimed Player or name a new one.
 * The list holds only Not Joined Players (decision 29) — a General Link can
 * never take over someone who already has a device, so offering their name
 * would only ever end in a refusal.
 */
function GeneralPicker({
  notJoined,
  disabled,
  onChoose,
}: {
  notJoined: { id: string; name: string }[];
  disabled: boolean;
  onChoose: (choice: GeneralChoice) => void;
}) {
  const [newName, setNewName] = useState("");
  const trimmed = newName.trim();

  return (
    <>
      <p className="mt-3 text-base leading-normal font-semibold text-muted-foreground">
        Pick yourself off the roster, or add yourself if you&apos;re new.
      </p>

      {notJoined.length > 0 && (
        <div className="mt-4 flex flex-col gap-1.5">
          {notJoined.map((player) => (
            <Button
              key={player.id}
              variant="outline"
              disabled={disabled}
              onClick={() =>
                onChoose({
                  kind: "existing",
                  playerId: player.id,
                  name: player.name,
                })
              }
            >
              {player.name}
            </Button>
          ))}
        </div>
      )}

      <div className="mt-5 border-t border-hairline pt-4">
        <label htmlFor="new-name" className="section-label">
          {notJoined.length > 0 ? "Not on the list?" : "Add yourself"}
        </label>
        <div className="mt-2 flex gap-1.5">
          <Input
            id="new-name"
            value={newName}
            placeholder="Your name"
            maxLength={40}
            autoComplete="off"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && trimmed !== "") {
                onChoose({ kind: "new", name: trimmed });
              }
            }}
            className="h-10 text-base"
          />
          <Button
            variant="chip"
            disabled={disabled || trimmed === ""}
            onClick={() => onChoose({ kind: "new", name: trimmed })}
          >
            Add
          </Button>
        </div>
      </div>
    </>
  );
}

function Warning({ replacing }: { replacing: boolean }) {
  return (
    <p className="mt-3 text-base leading-normal font-semibold text-muted-foreground">
      {replacing
        ? "This replaces your current device. The old one loses access as soon as you join here."
        : "Every match logged on this device gets credited to you."}{" "}
      <span className="text-foreground">
        This installation can&apos;t switch to another player afterwards without
        the group admin.
      </span>
    </p>
  );
}

// Server-side error codes are deliberately terse; the prose lives here. Each
// one names what actually happened — no "partially joined", because no such
// state exists: confirmation is one transaction that either bound this
// installation or changed nothing at all.
const MESSAGES: Record<string, string> = {
  "not-found": "This invite link isn't valid any more.",
  revoked: "The group admin revoked this link. Ask for a fresh one.",
  consumed: "This link has already been used. Ask the admin for a new one.",
  expired: "This link has expired. Ask the admin for a fresh one.",
  "player-unavailable": "That player is no longer on the roster.",
  "player-already-joined":
    "Someone just joined as that player. Pick another, or add yourself.",
  "wrong-link-kind": "That isn't what this link is for.",
  "name-blank": "Enter a name.",
  "name-too-long": "That name is too long.",
  "name-taken":
    "Someone on the roster already has that name. Try a different one.",
  "rate-limited": "Too many attempts just now. Wait a moment and try again.",
};
