import { NotJoined } from "@/components/not-joined";
import { TabShell } from "@/components/tab-shell";
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

  return <TabShell>{children}</TabShell>;
}
