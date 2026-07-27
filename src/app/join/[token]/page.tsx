import { redirect } from "next/navigation";
import { JoinView } from "@/components/join-view";
import { isBound } from "@/services/auth/binding";
import { getDb } from "@/services/db";
import { previewInvitation } from "@/services/onboarding";

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

  return (
    <JoinView
      token={token}
      result={await previewInvitation(getDb(), token)}
    />
  );
}
