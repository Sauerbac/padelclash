import type { Metadata } from "next";
import { requirePlayerId, requireSession } from "@/auth";
import { getPlayerStanding, listMemberGroups } from "@/services/groups";
import { RatingDelta } from "@/ui";
import { LogoutButton } from "./LogoutButton";

export const metadata: Metadata = {
  title: "Me · PadelClash",
};

// Protected route: unauthenticated visitors are redirected to /login by
// requireSession. Reads the live session, so it must stay dynamic.
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireSession();
  const playerId = await requirePlayerId();

  // Group-scoped navigation is deferred (open-question 06); the bullet is single-
  // group, so the profile shows the viewer's standing in their first group.
  const groups = await listMemberGroups(playerId);
  const standing = groups[0]
    ? await getPlayerStanding({ groupId: groups[0].id, playerId })
    : null;

  return (
    <main className="flex flex-col gap-6 px-6 pb-24 pt-12">
      <h1 className="font-display text-heading text-ink">{session.user.name}</h1>
      <p className="font-body text-body text-secondary">{session.user.email}</p>

      {standing ? (
        <section className="flex flex-col gap-3 rounded-card border-bold border-ink bg-surface px-5 py-5 shadow-resting">
          <span className="font-mono text-meta font-bold uppercase tracking-wide text-secondary">
            {groups[0].name}
          </span>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-display tabular-nums text-ink">
              {Math.round(standing.rating)}
            </span>
            {/* The dopamine: the change from the last competitive match (screens.md §6). */}
            {standing.lastDelta !== null && (
              <RatingDelta value={Math.round(standing.lastDelta)} />
            )}
          </div>
          <span className="font-mono text-meta font-bold uppercase tracking-wide text-secondary">
            {standing.competitiveMatchesPlayed}{" "}
            {standing.competitiveMatchesPlayed === 1 ? "match" : "matches"}
            {standing.isProvisional ? " · provisional" : ""}
          </span>
        </section>
      ) : (
        <p className="font-body text-body text-secondary">
          No competitive matches yet — log one to start your rating.
        </p>
      )}

      <LogoutButton />
    </main>
  );
}
