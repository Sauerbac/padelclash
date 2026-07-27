"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { absoluteInvitationUrl } from "@/lib/invitation-link";

/**
 * Copy a newly issued or existing invitation. Keeping generation and manual
 * copying on this path gives both the same full-URL and fallback behaviour.
 */
export async function copyInvitationLink(path: string): Promise<void> {
  const url = absoluteInvitationUrl(path, window.location.origin);
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // Clipboard needs HTTPS or localhost; show the link as a last resort.
    window.prompt("Copy the link:", url);
  }
}

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
    await copyInvitationLink(path);
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
