import { NotJoined } from "@/components/not-joined";
import { TabBar } from "@/components/tab-bar";
import { viewerForPrivateRead } from "@/services/auth/authz";

/**
 * The three-tab shell, and the read gate in front of it (spec decision 33).
 * Every player-facing screen — Feed, Log Match, Leaderboard, Player Detail,
 * match editing — lives under this layout, so gating here covers all of them
 * at one seam. An Admin session passes without a binding (decision 49).
 *
 * This is not the only check: each server action re-validates independently,
 * because a layout guards what renders, not what runs.
 */
export default async function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!(await viewerForPrivateRead())) return <NotJoined />;

  return (
    // `shrink-0`, not `flex-1`: as a flex child of #scroll-root, `min-h-full`
    // (min-height: 100%) replaces the automatic minimum size, so a growable
    // item collapses to the viewport and its content merely overflows —
    // dragging the tab-bar reserve below up with it, out of reach of the
    // scroller. Sizing to content and growing only via min-height fixes both.
    <div className="flex min-h-full shrink-0 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      {children}
      <TabBar />
    </div>
  );
}
