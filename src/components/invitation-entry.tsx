"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invitationDestination } from "@/lib/invitation-entry";
import { useStandaloneDisplayMode } from "@/lib/use-pwa-presentation";

export function InvitationEntry({
  installed: installedOverride,
  initialInput = "",
  initialError = null,
}: {
  /** Only the gallery passes this to render the installed-PWA state. */
  installed?: boolean;
  /** Gallery seam for the filled invitation field. */
  initialInput?: string;
  /** Gallery seam for the rejected local-parse state. */
  initialError?: string | null;
} = {}) {
  const router = useRouter();
  const detectedInstalled = useStandaloneDisplayMode();
  const installed = installedOverride ?? detectedInstalled;
  const [input, setInput] = useState(initialInput);
  const [error, setError] = useState<string | null>(initialError);

  if (!installed) return null;

  function continueToInvitation() {
    const destination = invitationDestination(input, window.location.origin);
    if (!destination.ok) {
      setError(destination.message);
      return;
    }

    setError(null);
    router.push(destination.href);
  }

  return (
    <form
      className="mt-5 border-t border-hairline pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        continueToInvitation();
      }}
    >
      <label htmlFor="invitation" className="section-label">
        Open your invitation
      </label>
      <p className="mt-2 text-sm font-semibold text-muted-foreground">
        Paste the full invite link from the admin. A raw invitation token works
        too.
      </p>
      <Input
        id="invitation"
        className="mt-3"
        value={input}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="https://…/join/…"
        onChange={(event) => {
          setInput(event.target.value);
          if (error) setError(null);
        }}
      />
      <Button type="submit" className="mt-2 w-full">
        Continue to invitation
      </Button>
      {error && (
        <Alert variant="destructive" className="mt-3">
          {error}
        </Alert>
      )}
    </form>
  );
}
