"use client";

import * as React from "react";
import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AdminLoginAction = (
  previousState: FormState,
  formData: FormData,
) => Promise<FormState>;

export function AdminLogin({
  login = loginAction,
  initialPassword,
  autoSubmit = false,
}: {
  login?: AdminLoginAction;
  /** Gallery-only input used by an auto-driven action case. */
  initialPassword?: string;
  /** Gallery-only trigger that submits through the real useActionState path. */
  autoSubmit?: boolean;
} = {}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    login,
    {},
  );
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (autoSubmit) formRef.current?.requestSubmit();
  }, [autoSubmit]);

  return (
    <div className="w-full max-w-sm border px-5 py-6">
      <p className="kicker">Staff only</p>
      <h1 className="mt-2 font-display text-[34px] leading-[1.1] uppercase">
        Admin Login
      </h1>
      <form ref={formRef} action={formAction}>
        <Label htmlFor="password" className="mt-5 text-xs">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoFocus
          required
          defaultValue={initialPassword}
          className="mt-1.5 font-mono tracking-[3px]"
        />
        {state.error && (
          <p className="mt-2 text-sm font-semibold text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" className="mt-4 w-full" disabled={pending}>
          {pending ? "Checking…" : "Log in"}
        </Button>
      </form>
    </div>
  );
}
