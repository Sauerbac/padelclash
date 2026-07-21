"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  confirmJoinAction,
  type JoinConfirmation,
} from "@/app/actions/onboarding";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvitationPreview } from "@/services/onboarding";

/**
 * The explicit confirmation both link kinds require (spec decisions 42 and
 * 43). Nothing here mutates until the visitor presses the button, and the
 * warning about not being able to switch without Admin is mandatory copy, not
 * decoration — it is the one thing they can't undo themselves.
 *
 * Deliberately plain: the frontend tranche owns the finished onboarding
 * screens. What matters is that no path binds without a confirmed intent.
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

  // General Link only: which Not Joined Player, or a new name.
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  function confirm(confirmation: JoinConfirmation) {
    setError(null);
    startTransition(async () => {
      const result = await confirmJoinAction(confirmation);
      if (result.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      setError(MESSAGES[result.error] ?? "Couldn't join. Ask the group admin.");
    });
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm border px-5 py-6">
        <p className="kicker">Welcome to the club</p>

        {preview.kind === "personal" ? (
          <>
            <h1 className="mt-2.5 font-display text-4xl leading-[1.1] uppercase">
              Join as {preview.player.name}
            </h1>
            <Warning replacing={preview.replacesBinding} />
            <Button
              className="mt-4 w-full"
              disabled={pending}
              onClick={() => confirm({ via: "personal", token })}
            >
              {pending ? "Joining…" : `Join as ${preview.player.name}`}
            </Button>
          </>
        ) : (
          <>
            <h1 className="mt-2.5 font-display text-4xl leading-[1.1] uppercase">
              Who are you?
            </h1>
            <Warning replacing={false} />

            <div className="mt-4 flex flex-col gap-1.5">
              {preview.notJoined.map((player) => (
                <Button
                  key={player.id}
                  variant={selected === player.id ? "default" : "outline"}
                  aria-pressed={selected === player.id}
                  onClick={() => {
                    setSelected(player.id);
                    setNewName("");
                  }}
                >
                  {player.name}
                </Button>
              ))}
            </div>

            <div className="mt-4">
              <label
                htmlFor="new-name"
                className="section-label text-muted-foreground"
              >
                Not on the list?
              </label>
              <Input
                id="new-name"
                value={newName}
                placeholder="Your name"
                onChange={(e) => {
                  setNewName(e.target.value);
                  setSelected(null);
                }}
                className="mt-1.5 h-10 text-base"
              />
            </div>

            <Button
              className="mt-4 w-full"
              disabled={pending || (!selected && newName.trim() === "")}
              onClick={() =>
                confirm(
                  selected
                    ? { via: "general-existing", token, playerId: selected }
                    : { via: "general-new", token, name: newName },
                )
              }
            >
              {pending ? "Joining…" : "Join the circle"}
            </Button>
          </>
        )}

        {error && (
          <div className="mt-3">
            <Alert variant="destructive">{error}</Alert>
          </div>
        )}
      </div>
    </main>
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

// Server-side error codes are deliberately terse; the prose lives here.
const MESSAGES: Record<string, string> = {
  "not-found": "This invite link isn't valid any more.",
  revoked: "The group admin revoked this link.",
  consumed: "This link has already been used.",
  expired: "This link has expired.",
  "player-unavailable": "That player is no longer on the roster.",
  "player-already-joined":
    "Someone already joined as that player. Pick another name.",
  "already-bound": "This device is already joined to a player.",
  "wrong-link-kind": "That isn't what this link is for.",
  "name-blank": "Enter a name.",
  "name-too-long": "That name is too long.",
  "name-taken": "Someone on the roster already has that name.",
  "rate-limited": "Too many attempts. Wait a moment and try again.",
};
