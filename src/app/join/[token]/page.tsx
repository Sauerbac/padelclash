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
  revoked: "The group admin revoked this link.",
  consumed: "This link has already been used to join.",
  expired: "This link has expired.",
  "player-unavailable": "That player is no longer on the roster.",
};

function DeadLink({ problem }: { problem: InvitationProblem }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10">
      <div className="border px-5 py-6">
        <p className="kicker">No entry</p>
        <h1 className="mt-2.5 font-display text-[40px] leading-[1.05] uppercase">
          Dead link
        </h1>
        {/* Kind-agnostic on purpose: the preview failed, so there is nothing
            here that knows whether this was a Personal Link (single-use, 7
            days) or a General one (reusable for 12 hours). Claiming either
            would be wrong half the time. */}
        <p className="mt-3 text-base leading-normal font-semibold text-muted-foreground">
          {EXPLANATIONS[problem]} Ask the group admin for a fresh one — invites
          expire, and can be revoked at any time.
        </p>
      </div>
    </main>
  );
}
