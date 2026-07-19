"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminLogin() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    loginAction,
    {},
  );

  return (
    <div className="w-full max-w-sm border px-5 py-6">
      <p className="kicker">Staff only</p>
      <h1 className="mt-2 font-display text-[34px] leading-[1.1] uppercase">
        Admin Login
      </h1>
      <form action={formAction}>
        <Label htmlFor="password" className="mt-5 text-xs">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoFocus
          required
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
