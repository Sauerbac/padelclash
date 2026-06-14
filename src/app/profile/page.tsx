import type { Metadata } from "next";
import { requireSession } from "@/auth";
import { LogoutButton } from "./LogoutButton";

export const metadata: Metadata = {
  title: "Me · PadelClash",
};

// Protected route: unauthenticated visitors are redirected to /login by
// requireSession. Reads the live session, so it must stay dynamic.
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireSession();

  return (
    <main className="flex flex-col gap-6 px-6 pb-24 pt-12">
      <h1 className="font-display text-heading text-ink">
        {session.user.name}
      </h1>
      <p className="font-body text-body text-secondary">{session.user.email}</p>
      <LogoutButton />
    </main>
  );
}
