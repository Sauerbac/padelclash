"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPlayerAction, type FormState } from "@/app/actions/admin";
import { Alert } from "@/components/ui/alert";
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
    <form ref={formRef} action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <Input name="name" placeholder="New player name" required />
        <Button type="submit" disabled={pending} className="px-5 text-base">
          Add
        </Button>
      </div>
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
    </form>
  );
}
