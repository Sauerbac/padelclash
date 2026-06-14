import type { Metadata } from "next";
import { requireSession } from "@/auth";
import { CreateGroupForm } from "./CreateGroupForm";

export const metadata: Metadata = {
  title: "New group · PadelClash",
};

// Protected route: only a signed-in Player may found a group. Reads the live
// session, so it must stay dynamic.
export const dynamic = "force-dynamic";

export default async function NewGroupPage() {
  await requireSession();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-6 pb-24 pt-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-heading text-ink">Create a group</h1>
        <p className="font-body text-body text-secondary">
          Your group is its own leaderboard. You&apos;ll be its first member and
          admin.
        </p>
      </header>
      <CreateGroupForm />
    </main>
  );
}
