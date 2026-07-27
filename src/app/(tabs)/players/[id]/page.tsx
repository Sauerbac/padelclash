import { notFound } from "next/navigation";
import { NotJoined } from "@/components/not-joined";
import { PlayerDetailView } from "@/components/player-detail-view";
import { currentActor } from "@/services/auth/actor";
import { viewerForPrivateRead } from "@/services/auth/authz";
import { getDb } from "@/services/db";
import { getPlayerDetail } from "@/services/matches";

export const metadata = { title: "Player · PadelClash" };

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Gate before the query — see viewerForPrivateRead.
  if (!(await viewerForPrivateRead())) return <NotJoined />;

  const db = getDb();
  const [viewer, detail] = await Promise.all([
    currentActor(),
    getPlayerDetail(db, id),
  ]);
  if (!detail) notFound();
  return (
    <PlayerDetailView detail={detail} viewer={viewer} now={new Date()} />
  );
}
