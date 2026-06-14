"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui";
import { signOut } from "@/auth/client";

// Clears the session, then sends the visitor back to sign in. `refresh` drops the
// now-stale server-rendered session state.
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="secondary" disabled={pending} onClick={onClick}>
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
}
