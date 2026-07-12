import { MatchForm } from "@/components/match-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBoundPlayer } from "@/services/auth/binding";
import { getDb } from "@/services/db";
import { listActivePlayers } from "@/services/players";

export default async function LogMatchPage() {
  const db = getDb();
  const [you, roster] = await Promise.all([
    getBoundPlayer(),
    listActivePlayers(db),
  ]);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Log Match</h1>

      {you ? (
        <MatchForm
          roster={roster.map(({ id, name }) => ({ id, name }))}
          loggerId={you.id}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Who&apos;s logging?</CardTitle>
            <CardDescription>
              This device isn&apos;t bound to a player yet, so matches can&apos;t
              be credited. Open your personal join link first — or ask the
              group admin for one.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      )}
    </main>
  );
}
