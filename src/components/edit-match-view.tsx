import Link from "next/link";
import {
  MatchForm,
  type MatchFormActions,
  type EditableMatch,
} from "@/components/match-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

type EditMatchViewProps =
  | { state: "locked" }
  | {
      state: "editable";
      roster: { id: string; name: string }[];
      reservedPlayerNames: string[];
      editing: EditableMatch;
      actions?: MatchFormActions;
    };

export function EditMatchView(props: EditMatchViewProps) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader kicker="Corrections desk" title="Edit Match" />

      {props.state === "locked" ? (
        <section className="border px-5 py-6 text-center">
          <div aria-hidden className="text-3xl">
            🔒
          </div>
          <h2 className="mt-2.5 font-display text-[26px] leading-[1.1] uppercase">
            This match is locked
          </h2>
          <p className="mt-2.5 text-[15px] leading-relaxed font-semibold text-muted-foreground">
            Only the player who logged a match can edit it, and only within 24
            hours. Ask the group admin to fix it — bribes optional.
          </p>
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link href="/">Back to feed</Link>
          </Button>
        </section>
      ) : (
        <MatchForm
          roster={props.roster}
          reservedPlayerNames={props.reservedPlayerNames}
          editing={props.editing}
          actions={props.actions}
        />
      )}
    </main>
  );
}
