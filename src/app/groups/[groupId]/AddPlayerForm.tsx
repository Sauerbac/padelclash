"use client";

import { useActionState } from "react";
import { Button, TextInput } from "@/ui";
import { addUnclaimedPlayerAction, type AddPlayerState } from "./actions";

const INITIAL: AddPlayerState = {};

// Founder-bootstrap path (screens.md §1): add a player as just a name. On success
// the action revalidates the board so the new chip appears in the roster below;
// React resets this uncontrolled form, so the field clears for the next add.
export function AddPlayerForm({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(
    addUnclaimedPlayerAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="groupId" value={groupId} />
      <TextInput
        label="Add a player"
        name="name"
        type="text"
        placeholder="Someone's cousin"
        autoComplete="off"
        required
        maxLength={80}
      />

      {state.error && (
        <p role="alert" className="font-body text-body font-bold text-primary">
          {state.error}
        </p>
      )}
      {state.addedName && !state.error && (
        <p className="font-body text-body text-secondary">
          Added {state.addedName}.
        </p>
      )}

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Adding…" : "Add player"}
      </Button>
    </form>
  );
}
