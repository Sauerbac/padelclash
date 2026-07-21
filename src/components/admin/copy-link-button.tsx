"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Copies an onboarding link to the clipboard. The origin is only known on the
 * client, so the caller passes the path and this assembles the URL.
 */
export function CopyLinkButton({
  path,
  label,
}: {
  path: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard needs HTTPS or localhost; show the link as a last resort.
      window.prompt("Copy the link:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button
      variant="chip"
      size="xs"
      onClick={copy}
      className={copied ? "border-accent text-accent" : undefined}
    >
      {copied ? "Copied!" : label}
    </Button>
  );
}
