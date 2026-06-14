import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePlayerId } from "@/auth";
import { getGroupForMember, getLeaderboard } from "@/services/groups";
import { LeaderboardRow } from "@/ui";
import type { AvatarColor } from "@/ui";
import { GroupHeader } from "@/app/_shell/GroupHeader";

// Reads the live session + projection, so it must stay dynamic.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ groupId: string }>;
}): Promise<Metadata> {
  const playerId = await requirePlayerId();
  const { groupId } = await params;
  const group = await getGroupForMember({ groupId, playerId });
  return { title: group ? `${group.name} · PadelClash` : "PadelClash" };
}

// Avatars cycle through the four identity accents by board position — stable for a
// given board, and the accent palette is used sparingly per binding §8.
const AVATAR_COLORS: AvatarColor[] = ["teal", "violet", "butter", "primary"];

export default async function GroupBoardPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const playerId = await requirePlayerId();
  const { groupId } = await params;

  // Authorization gate: a non-member (or a missing group) both resolve to null,
  // so we 404 either way — the group's existence is not leaked to outsiders.
  const group = await getGroupForMember({ groupId, playerId });
  if (!group) notFound();

  const entries = await getLeaderboard(groupId);

  return (
    <>
      <GroupHeader name={group.name} />
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 pt-6 pb-24">
        <h2 className="font-mono text-meta font-bold uppercase tracking-wide text-secondary">
          Leaderboard
        </h2>

        {entries.length === 0 ? (
          <div className="flex flex-col gap-2 rounded-card border-bold border-ink bg-surface px-5 py-8 text-center">
            <p className="font-display text-title text-ink">No ratings yet</p>
            <p className="font-body text-body text-secondary">
              Add players and log your first match — the leaderboard fills in as
              soon as a competitive match is played.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {entries.map((entry, i) => (
              <LeaderboardRow
                key={entry.playerId}
                rank={i + 1}
                name={entry.name}
                rating={Math.round(entry.rating)}
                avatarColor={AVATAR_COLORS[i % AVATAR_COLORS.length]}
                you={entry.playerId === playerId}
                unranked={!entry.isRanked}
                unrankedLabel={`${entry.competitiveMatchesPlayed} of ${group.rankedThreshold}`}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
