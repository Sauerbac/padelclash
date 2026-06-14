import { redirect } from "next/navigation";
import { requirePlayerId } from "@/auth";
import { listMemberGroups } from "@/services/groups";

// The "Board" tab / app entry. Almost every screen lives inside one group
// (screens.md §0), so home resolves the viewer into their group context: into
// their group's board, or to create one if they have none. Reads the live
// session, so it must stay dynamic.
export const dynamic = "force-dynamic";

export default async function Home() {
  const playerId = await requirePlayerId();
  const groups = await listMemberGroups(playerId);

  // Multi-group switching is deferred (open-question 06); land on the first group.
  if (groups.length === 0) redirect("/groups/new");
  redirect(`/groups/${groups[0].id}`);
}
