"use client";

import { useActionState } from "react";
import { Button, TextInput } from "@/ui";
import { createGroupAction, type CreateGroupState } from "../actions";

const INITIAL: CreateGroupState = {};

// Founder path (screens.md §1): name only, nothing else. On success the action
// redirects to the new group, so this form only ever renders the entry + an
// inline error.
export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(
    createGroupAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <TextInput
        label="Group name"
        name="name"
        type="text"
        placeholder="Monday Smashers"
        autoComplete="off"
        required
        maxLength={80}
      />

      {state.error && (
        <p role="alert" className="font-body text-body font-bold text-primary">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create group"}
      </Button>
    </form>
  );
}
