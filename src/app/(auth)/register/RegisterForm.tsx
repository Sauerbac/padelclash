"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, TextInput } from "@/ui";
import { signUp } from "@/auth/client";

// Fresh registration (ADR-0004): creates the Account + its linked Player and
// triggers the verification email. On success we don't sign in (verification is
// required first) — we tell the visitor to check their inbox.
export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    // The verification link lands here once confirmed; from there the visitor
    // signs in.
    const { error } = await signUp.email({
      name,
      email,
      password,
      callbackURL: "/login?verified=1",
    });
    setPending(false);
    if (error) {
      setError(error.message ?? "Could not create your account.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-heading text-ink">Check your email</h1>
        <p className="font-body text-body text-secondary">
          We sent a verification link to <span className="text-ink">{email}</span>
          . Open it to finish setting up your account, then sign in.
        </p>
        <Link
          href="/login"
          className="font-mono text-meta font-bold uppercase tracking-wide text-primary underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <h1 className="font-display text-heading text-ink">Create account</h1>

      <div className="flex flex-col gap-4">
        <TextInput
          label="Name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          autoComplete="new-password"
          required
          minLength={8}
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
        {pending ? "Creating…" : "Create account"}
      </Button>

      <p className="font-body text-body text-secondary">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
