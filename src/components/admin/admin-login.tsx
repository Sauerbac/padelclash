"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminLogin() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    loginAction,
    {},
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Admin login</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoFocus
            required
          />
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter className="pt-4">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Checking…" : "Log in"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
