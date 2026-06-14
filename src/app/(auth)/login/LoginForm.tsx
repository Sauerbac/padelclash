"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, TextInput } from "@/ui";
import { signIn } from "@/auth/client";

// Sign in with verified credentials. On success Better Auth sets the session
// cookie; we then navigate to the (protected) profile and refresh so the server
// components re-read the new session.
export function LoginForm({ verified }: { verified?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await signIn.email({ email, password });
    if (error) {
      setPending(false);
      setError(error.message ?? "Could not sign you in.");
      return;
    }
    router.push("/profile");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <h1 className="font-display text-heading text-ink">Sign in</h1>

      {verified && (
        <p className="font-body text-body font-bold text-teal">
          Email verified — sign in to continue.
        </p>
      )}

      <div className="flex flex-col gap-4">
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInput
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="font-body text-body font-bold text-primary">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="font-body text-body text-secondary">
        New here?{" "}
        <Link href="/register" className="text-primary underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
