import { JoinConfirm, type ConfirmJoin } from "@/components/join-confirm";
import type {
  InvitationProblem,
  PreviewResult,
} from "@/services/onboarding";

const EXPLANATIONS: Record<InvitationProblem, string> = {
  "not-found": "This invite link isn't valid.",
  revoked: "The group admin revoked this link.",
  consumed: "This link has already been used to join.",
  expired: "This link has expired.",
  "player-unavailable": "That player is no longer on the roster.",
};

export function JoinView({
  token,
  result,
  confirmJoin,
  showRecoveryGuidance,
}: {
  token: string;
  result: PreviewResult;
  confirmJoin?: ConfirmJoin;
  showRecoveryGuidance?: boolean;
}) {
  return result.ok ? (
    <JoinConfirm
      token={token}
      preview={result.preview}
      confirmJoin={confirmJoin}
      showRecoveryGuidance={showRecoveryGuidance}
    />
  ) : (
    <DeadLink problem={result.error} />
  );
}

export function DeadLink({ problem }: { problem: InvitationProblem }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10">
      <div className="border px-5 py-6">
        <p className="kicker">No entry</p>
        <h1 className="mt-2.5 font-display text-[40px] leading-[1.05] uppercase">
          Dead link
        </h1>
        <p className="mt-3 text-base leading-normal font-semibold text-muted-foreground">
          {EXPLANATIONS[problem]} Ask the group admin for a fresh one — invites
          expire, and can be revoked at any time.
        </p>
      </div>
    </main>
  );
}
