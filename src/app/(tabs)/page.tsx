import { NamePicker } from "@/components/name-picker";
import { Badge } from "@/components/ui/badge";
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
import { getSettings } from "@/services/settings";

export default async function Home() {
  const db = getDb();
  const [you, settings, roster] = await Promise.all([
    getBoundPlayer(),
    getSettings(db),
    listActivePlayers(db),
  ]);

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

      <Card>
        <CardHeader>
          <CardTitle>Roster</CardTitle>
          <CardDescription>
            The feed arrives with the next slice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">No players yet.</p>
          ) : (
            <ul className="space-y-2">
              {roster.map((player) => (
                <li key={player.id} className="flex items-center gap-2 text-sm">
                  {player.name}
                  {you?.id === player.id && <Badge variant="secondary">You</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
