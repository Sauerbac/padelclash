"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPlayerAction, type FormState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreatePlayerForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createPlayerAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the input after a successful create (state without error = success).
  useEffect(() => {
    if (!state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-1">
      <div className="flex gap-2">
        <Input name="name" placeholder="New player name" required />
        <Button type="submit" disabled={pending}>
          Add
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
