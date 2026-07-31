import { FeedView } from "@/components/feed-view";
import { InvitationEntry } from "@/components/invitation-entry";
import { NotJoined } from "@/components/not-joined";
import type { PullIndicatorPhase } from "@/components/pull-to-refresh";
import {
  IncompatibleQueuedMatchCard,
  QueuedMatchCard,
} from "@/components/queued-matches";
import { TabShell } from "@/components/tab-shell";
import {
  FEED,
  FEED_NONE_EDITABLE,
  NOW,
  QUEUED_BLOCKED,
  QUEUED_BY_RECORD_STATE,
  QUEUED_PENDING,
  QUEUED_TRANSIENT,
  YOU,
} from "./fixtures";

/**
 * Every state in `docs/ui/feed.md`, as a case that renders on its own route.
 *
 * These are hand-curated scenarios, not a generated cross product: singles vs
 * doubles × set count × Guest × edit rights × Admin is open combinatorics, and
 * decision 128 says so out loud rather than drowning the signal in hundreds of
 * near-identical cards. The cost is that a state can be added to the doc and
 * forgotten here — which is why the two files are reviewed together.
 *
 * Each case renders its own shell. `/dev` sits outside the `(tabs)` route
 * group, so nothing supplies the tab bar unless the case does, and reviewing
 * Feed without it would miss the one piece of chrome anchored to the viewport.
 */

export interface FeedCase {
  title: string;
  note: string;
  render: () => React.ReactNode;
}

/** The three offline-queue cards, as `FeedView`'s queued slot. */
function queuedFixtures() {
  return (
    <div className="space-y-3">
      <QueuedMatchCard match={QUEUED_PENDING} />
      <QueuedMatchCard match={QUEUED_TRANSIENT} />
      <QueuedMatchCard match={QUEUED_BLOCKED} />
      <IncompatibleQueuedMatchCard
        match={QUEUED_BY_RECORD_STATE.incompatible}
      />
    </div>
  );
}

/** Nothing queued — what the real component renders on an empty queue. */
const noQueue = <></>;

function refreshPreview(phase: PullIndicatorPhase) {
  return (
    <TabShell pathname="/">
      <FeedView
        you={YOU}
        isAdmin={false}
        feed={FEED}
        now={NOW}
        queued={noQueue}
        pullToRefreshPhase={phase}
      />
    </TabShell>
  );
}

const PULL_CASES: Record<PullIndicatorPhase, FeedCase> = {
  pulling: {
    title: "Pull to refresh",
    note: "The Feed is moving with a downward drag, but the refresh threshold has not been crossed yet. Releasing now settles without a request.",
    render: () => refreshPreview("pulling"),
  },
  ready: {
    title: "Release to refresh",
    note: "The Feed crossed the threshold. Releasing now reloads its server data while the fixed tab bar stays put.",
    render: () => refreshPreview("ready"),
  },
  refreshing: {
    title: "Refreshing",
    note: "The route refresh is in progress. The content stays offset until the new server-rendered Feed arrives.",
    render: () => refreshPreview("refreshing"),
  },
};

export const FEED_CASES: Record<string, FeedCase> = {
  ...PULL_CASES,

  bound: {
    title: "Bound device, matches in the log",
    note: "The everyday screen. Only the top card is editable: its logger is you and it is two hours old, inside the 24-hour grace window. The 96-hour-old card you also logged has aged out, which is the boundary worth eyeballing.",
    render: () => (
      <TabShell pathname="/">
        <FeedView
          you={YOU}
          isAdmin={false}
          feed={FEED}
          now={NOW}
          queued={noQueue}
        />
      </TabShell>
    ),
  },

  "bound-empty": {
    title: "Bound device, empty log",
    note: "The empty state: `No matches yet — log the first one.` There is no call-to-action button by design; the Log Match tab is the affordance.",
    render: () => (
      <TabShell pathname="/">
        <FeedView
          you={YOU}
          isAdmin={false}
          feed={[]}
          now={NOW}
          queued={noQueue}
        />
      </TabShell>
    ),
  },

  "no-edit-rights": {
    title: "Bound device, nothing the viewer may touch",
    note: "Every match was logged by someone else, so no card shows an action area at all. Confirms the timestamp row doesn't collapse or shift when the buttons are absent.",
    render: () => (
      <TabShell pathname="/">
        <FeedView
          you={YOU}
          isAdmin={false}
          feed={FEED_NONE_EDITABLE}
          now={NOW}
          queued={noQueue}
        />
      </TabShell>
    ),
  },

  admin: {
    title: "Admin session, no binding on this device",
    note: "Admin reads past the gate without a Player (decision 49), so the identity line says logging needs a joined player. Every card carries the LOGGED BY rule (decision 53) and every card is editable, at any age.",
    render: () => (
      <TabShell pathname="/">
        <FeedView
          you={null}
          isAdmin
          feed={FEED}
          now={NOW}
          queued={noQueue}
        />
      </TabShell>
    ),
  },

  queued: {
    title: "Queued matches above an empty log",
    note: "All three queue states at once: pending, a transient refusal that keeps the gold frame and offers no Discard, and a permanent one in ember red that does. Also shows the documented oddity that the empty-feed line still renders below pending cards.",
    render: () => (
      <TabShell pathname="/">
        <FeedView
          you={YOU}
          isAdmin={false}
          feed={[]}
          now={NOW}
          queued={queuedFixtures()}
        />
      </TabShell>
    ),
  },

  "queued-over-feed": {
    title: "Queued matches above a populated log",
    note: "Queued cards sort above synced ones regardless of played time. The dashed frames next to solid ones are the whole point — the two must read as one component in two states.",
    render: () => (
      <TabShell pathname="/">
        <FeedView
          you={YOU}
          isAdmin={false}
          feed={FEED}
          now={NOW}
          queued={queuedFixtures()}
        />
      </TabShell>
    ),
  },

  "not-joined": {
    title: "Not joined — the read gate",
    note: "Returned before the feed is ever queried (decision 33), and outside the tab shell, so there is no bar. It still carries the queue: a device that just lost its binding may hold matches only Discard may remove (decision 26).",
    render: () => <NotJoined queued={noQueue} invitation={null} />,
  },

  "not-joined-queued": {
    title: "Not joined, holding a stuck match",
    note: "The reason the gate carries a queue at all. Revocation makes this device's queued match permanently unsyncable, and this screen is the only place its owner can discard it.",
    render: () => (
      <NotJoined
        queued={<QueuedMatchCard match={QUEUED_BLOCKED} />}
        invitation={null}
      />
    ),
  },

  "not-joined-installed": {
    title: "Not joined in an installed PWA",
    note: "The invitation paste form is visible only in standalone display mode; this fixture pins that presentation state without reading the reviewer's browser.",
    render: () => (
      <NotJoined
        queued={noQueue}
        invitation={<InvitationEntry installed />}
      />
    ),
  },

  "not-joined-invitation-filled": {
    title: "Installed PWA with an invitation pasted",
    note: "The full same-site link is visible before navigation; parsing it has no server side effects.",
    render: () => (
      <NotJoined
        queued={noQueue}
        invitation={
          <InvitationEntry
            installed
            initialInput="https://padel.example/join/fixture-token"
          />
        }
      />
    ),
  },

  "not-joined-invitation-invalid": {
    title: "Installed PWA with invalid invitation input",
    note: "Local validation is actionable and does not navigate or preview an invitation.",
    render: () => (
      <NotJoined
        queued={noQueue}
        invitation={
          <InvitationEntry
            installed
            initialInput="not an invitation"
            initialError="Paste a PadelClash invitation link or raw token."
          />
        }
      />
    ),
  },
};

export const FEED_CASE_IDS = Object.keys(FEED_CASES);

export const feedCaseHref = (id: string) => `/dev/gallery/feed/case/${id}`;
