import { canModifyMatch } from "@/domain/edit-rights";
import { MatchCard } from "@/components/match-card";
import { NamePicker } from "@/components/name-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <main className="mx-auto w-full max-w-lg flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">PadelClash</h1>

      {you ? (
        <p className="text-sm text-muted-foreground">
          This device is bound to{" "}
          <span className="font-medium text-foreground">{you.name}</span> —
          matches you log will be credited to you.
        </p>
      ) : settings.namePickerEnabled ? (
        <Card>
          <CardHeader>
            <CardTitle>Who are you?</CardTitle>
            <CardDescription>
              Pick your name to bind this device to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NamePicker
              roster={roster.map(({ id, name }) => ({ id, name }))}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          This device isn&apos;t bound to a player yet. Ask the group admin
          for your personal join link.
        </p>
      )}

      {feed.length === 0 ? (
        <p className="text-sm text-muted-foreground">
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
