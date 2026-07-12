import { logoutAction } from "@/app/actions/admin";
import { AdminLogin } from "@/components/admin/admin-login";
import { CreatePlayerForm } from "@/components/admin/create-player-form";
import { NamePickerToggle } from "@/components/admin/name-picker-toggle";
import { PlayerRow } from "@/components/admin/player-row";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isAdmin } from "@/services/auth/admin";
import { getDb } from "@/services/db";
import { listPlayers } from "@/services/players";
import { getSettings } from "@/services/settings";

export const metadata = { title: "Admin · PadelClash" };

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <AdminLogin />
      </main>
    );
  }

  const db = getDb();
  const [players, settings] = await Promise.all([
    listPlayers(db),
    getSettings(db),
  ]);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <form action={logoutAction}>
          <Button variant="ghost" size="sm" type="submit">
            Log out
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Players</CardTitle>
          <CardDescription>
            Share a player&apos;s join link to bind their device. Rotating a
            link kills the old one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CreatePlayerForm />
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground">No players yet.</p>
          ) : (
            <ul className="divide-y">
              {players.map((player) => (
                <PlayerRow
                  key={player.id}
                  playerId={player.id}
                  name={player.name}
                  personalToken={player.personalToken}
                  retired={player.retiredAt !== null}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <NamePickerToggle enabled={settings.namePickerEnabled} />
        </CardContent>
      </Card>
    </main>
  );
}
