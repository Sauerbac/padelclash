"use client";

import type { DeleteMatchActionResult } from "@/app/actions/matches";
import { MatchCardActions } from "@/components/match-card-actions";

/**
 * The states of `MatchCardActions` that props alone cannot reach, because they
 * live in `useTransition` (decision 127). Client-side, since a server component
 * cannot hand a stub function to a client one.
 *
 * Open the delete confirmation and press Delete to see each one.
 */

const MATCH_ID = "aaaaaaaa-0001-7000-8000-000000000000";

/** Never resolves — freezes the disabled pending state for inspection. */
const neverResolves = (): Promise<DeleteMatchActionResult> => new Promise(() => {});

/** Refused by the server: the component surfaces the message via window.alert. */
const refuses = async (): Promise<DeleteMatchActionResult> => ({
  ok: false,
  code: "not-allowed",
  error: "That match is older than 24 hours and wasn't logged by you.",
});

/** Succeeds. In the app `revalidatePath` refreshes the feed; here, nothing. */
const succeeds = async (): Promise<DeleteMatchActionResult> => ({ ok: true });

export function DeleteActionCases() {
  return (
    <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
      <Labelled label="rest / success">
        <MatchCardActions matchId={MATCH_ID} deleteMatch={succeeds} />
      </Labelled>
      <Labelled label="pending (delete stays disabled)">
        <MatchCardActions matchId={MATCH_ID} deleteMatch={neverResolves} />
      </Labelled>
      <Labelled label="still waiting after 5 seconds">
        <MatchCardActions matchId={MATCH_ID} deleteMatch={neverResolves} waitPreview="slow" />
      </Labelled>
      <Labelled label="check result after 15 seconds">
        <MatchCardActions matchId={MATCH_ID} deleteMatch={neverResolves} waitPreview="uncertain" />
      </Labelled>
      <Labelled label="refused (alerts the reason)">
        <MatchCardActions matchId={MATCH_ID} deleteMatch={refuses} />
      </Labelled>
    </div>
  );
}

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p style={{ fontSize: 10, color: "#8f7d63", margin: "0 0 6px" }}>{label}</p>
      {children}
    </div>
  );
}
