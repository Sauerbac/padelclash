import { canModifyMatch } from "@/domain/edit-rights";
import { MatchCard } from "@/components/match-card";
import { NamePicker } from "@/components/name-picker";
import { PageHeader } from "@/components/page-header";
import { QueuedMatches } from "@/components/queued-matches";
import { isAdmin } from "@/services/auth/admin";
import { getBoundPlayer } from "@/services/auth/binding";
import { getDb } from "@/services/db";
import { getFeed } from "@/services/matches";
import { listActivePlayers } from "@/services/players";
import { getSettings } from "@/services/settings";

export default async function FeedPage() {
  const db = getDb();
  const [you, admin, settings, roster, feed] = await Promise.all([
    getBoundPlayer(),
    isAdmin(),
    getSettings(db),
    listActivePlayers(db),
    getFeed(db),
  ]);
  const viewer = { playerId: you?.id ?? null, isAdmin: admin };
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader kicker="Your club. Your receipts." title="PadelClash" />

      {you ? (
        <p className="text-[15px] font-semibold text-muted-foreground">
          Logging as <span className="text-accent uppercase">{you.name}</span>{" "}
          — new matches from this device are credited to you.
        </p>
      ) : settings.namePickerEnabled ? (
        <section className="border p-3.5">
          <h2 className="section-label">Who are you?</h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Pick your name to bind this device to you.
          </p>
          <div className="mt-3">
            <NamePicker roster={roster.map(({ id, name }) => ({ id, name }))} />
          </div>
        </section>
      ) : (
        <p className="text-[15px] font-semibold text-muted-foreground">
          This device isn&apos;t bound to a player yet. Ask the group admin
          for your personal join link.
        </p>
      )}

      <QueuedMatches />

      {feed.length === 0 ? (
        <p className="text-[15px] font-semibold text-muted-foreground">
          No matches yet — log the first one.
        </p>
      ) : (
        <div className="space-y-3">
          {feed.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              canModify={canModifyMatch(match, viewer, now)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
