import { redirect } from "next/navigation";
import { JoinConfirm } from "@/components/join-confirm";
import { isBound } from "@/services/auth/binding";
import { getDb } from "@/services/db";
import {
  previewInvitation,
  type InvitationProblem,
} from "@/services/onboarding";

export const metadata = { title: "Join · PadelClash" };

/**
 * The onboarding landing for both link kinds. Rendering it is a pure read:
 * opening, refreshing or link-previewing this page never consumes an
 * invitation or touches a binding (spec decisions 42 and 43). The join itself
 * happens only when the visitor presses the button in JoinConfirm.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // A bound installation can't switch Players, and finding that out must not
  // cost the invitation (spec decision 38).
  if (await isBound()) redirect("/");

  const result = await previewInvitation(getDb(), token);
  if (!result.ok) return <DeadLink problem={result.error} />;

  return <JoinConfirm token={token} preview={result.preview} />;
}

const EXPLANATIONS: Record<InvitationProblem, string> = {
  "not-found": "This invite link isn't valid.",
  revoked: "This invite link was revoked by the group admin.",
  consumed: "This invite link has already been used.",
  expired: "This invite link has expired.",
  "player-unavailable": "That player is no longer on the roster.",
};

function DeadLink({ problem }: { problem: InvitationProblem }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm border px-5 py-6">
        <h1 className="font-display text-3xl leading-[1.1] uppercase">
          This link doesn&apos;t work
        </h1>
        <p className="mt-3 text-base leading-normal font-semibold text-muted-foreground">
          {EXPLANATIONS[problem]} Ask the group admin for a fresh one.
        </p>
      </div>
    </main>
  );
}
