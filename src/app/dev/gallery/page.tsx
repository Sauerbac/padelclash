import Link from "next/link";
import { DeleteActionCases } from "./action-cases";
import { Case, GalleryPage, Section } from "./chrome";
import { GALLERY_SECTIONS } from "./registry";
import {
  QUEUED_BY_REFUSAL,
  QUEUED_BY_RECORD_STATE,
} from "./feed/fixtures";
import {
  IncompatibleQueuedMatchCard,
  QueuedMatchCard,
} from "@/components/queued-matches";
import { isPermanentRefusal, type MatchSyncRefusal } from "@/domain/sync-policy";

/**
 * The catalogue index (spec decision 126): links to the per-section pages, plus
 * the component-level cases that own no viewport and so need no iframe.
 *
 * Overview and switchboard for every catalogue section.
 */

const SECTION_NOTES: Record<
  Exclude<(typeof GALLERY_SECTIONS)[number]["id"], "overview">,
  string
> = {
  ds: "Every src/components/ui primitive: variants, sizes, interaction states and colour tokens.",
  feed: "Bound, Admin, empty, queued and read-gate states.",
  log: "Bound and unbound logging surfaces, including the real match form.",
  leaderboard: "Empty, early table, podium and mixed ranked/unranked standings.",
  player: "Active, retired and empty-history Player Detail views.",
  edit: "Editable and permission-locked match correction states.",
  join: "Personal, general and every closed invitation lifecycle state.",
  admin: "Login plus Joined, Not Joined and Retired roster management states.",
};

const REFUSAL_ORDER: Record<MatchSyncRefusal, number> = {
  "not-bound": 0,
  "rate-limited": 1,
  "identity-mismatch": 2,
  "not-allowed": 3,
  invalid: 4,
};

const refusalCodes = (Object.keys(REFUSAL_ORDER) as MatchSyncRefusal[]).sort(
  (a, b) => REFUSAL_ORDER[a] - REFUSAL_ORDER[b],
);

export default function GalleryIndex() {
  return (
    <GalleryPage
      title="UI state catalogue"
      intro="Every documented UI state, rendered from fixtures through the real Tailwind build and the real components. Nothing here queries the database or the device's offline queue."
      docs="docs/ui/README.md and docs/adr/0004-dev-only-ui-state-gallery.md"
    >
      <Section id="sections" title="Sections">
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          {GALLERY_SECTIONS.filter(
            (section) => section.id !== "overview",
          ).map((section) => (
            <li key={section.href} style={{ marginBottom: 10 }}>
              <Link href={section.href} style={{ color: "#d9a441" }}>
                {section.label}
              </Link>
              <span style={{ fontSize: 12, color: "#8f7d63" }}>
                {" — "}
                {
                  SECTION_NOTES[
                    section.id as keyof typeof SECTION_NOTES
                  ]
                }
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="incompatible-queue-record"
        title="Incompatible queued data"
        note="A durable record whose payload shape cannot be decoded stays visible and requires explicit Discard."
      >
        <Case
          id="incompatible-queued-match"
          title="decoder refusal"
          note="generic blocked card — no invented Match facts"
          width={390}
        >
          <IncompatibleQueuedMatchCard
            match={QUEUED_BY_RECORD_STATE.incompatible}
          />
        </Case>
      </Section>

      <Section
        id="sync-refusals"
        title="Queued card, one case per sync refusal"
        note="MatchSyncRefusal is a closed union, so the fixture map behind this list is a Record<MatchSyncRefusal, …> and tsc fails until a new code has a card. What it is checking: permanent refusals must turn the frame ember red and offer Discard, transient ones must stay gold and offer only a status line (decision 26)."
      >
        {refusalCodes.map((code) => (
          <Case
            key={code}
            id={`refusal-${code}`}
            title={`syncCode="${code}"`}
            note={
              isPermanentRefusal(code)
                ? "permanent — red frame, Discard offered"
                : "transient — gold frame, no Discard"
            }
            width={390}
          >
            <QueuedMatchCard match={QUEUED_BY_REFUSAL[code]} />
          </Case>
        ))}
      </Section>

      <Section
        id="match-card-actions"
        title="Match card actions"
        note="The edit and delete affordances on a feed card. The pending and refused states live in useTransition, so they are reachable only by injecting a stub action — which is what the optional deleteMatch prop exists for (decision 127)."
      >
        <Case
          id="delete-action-states"
          title="rest / pending / refused"
          note="open the confirmation and press Delete"
        >
          <DeleteActionCases />
        </Case>
      </Section>
    </GalleryPage>
  );
}
