"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useIosBrowserGuidance } from "@/lib/use-pwa-presentation";

export function JoinRecoveryGuidance() {
  const visible = useIosBrowserGuidance();
  const [copied, setCopied] = useState(false);

  if (!visible) return null;

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy the link:", window.location.href);
    }
  }

  return (
    <aside
      className="border border-accent px-4 py-4"
      aria-labelledby="ios-recovery-title"
    >
      <p className="kicker">Already installed?</p>
      <h2
        id="ios-recovery-title"
        className="mt-1.5 font-display text-2xl leading-tight uppercase"
      >
        Join inside the app
      </h2>
      <p className="mt-2 text-sm font-semibold text-muted-foreground">
        First, copy this full invite link. Open your installed PadelClash app
        and paste it on the Not Joined screen.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={copyInvitation}
      >
        {copied ? "Invite link copied" : "Copy full invite link"}
      </Button>
      <p className="mt-2 text-sm font-semibold text-muted-foreground">
        Or open and accept this invitation in Safari, remove the old Home
        Screen app, then add PadelClash to the Home Screen again from Safari.
      </p>
    </aside>
  );
}
