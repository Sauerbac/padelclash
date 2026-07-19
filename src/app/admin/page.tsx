import { logoutAction } from "@/app/actions/admin";
import { AdminLogin } from "@/components/admin/admin-login";
import { CreatePlayerForm } from "@/components/admin/create-player-form";
import { NamePickerToggle } from "@/components/admin/name-picker-toggle";
import { PageHeader } from "@/components/page-header";
import { PlayerRow } from "@/components/admin/player-row";
import { Button } from "@/components/ui/button";
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
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader
        kicker="The commissioner"
        title="Admin"
        actions={
          <form action={logoutAction}>
            <Button
              variant="outline"
              size="xs"
              type="submit"
              className="text-muted-foreground"
            >
              Log out
            </Button>
          </form>
        }
      />

      <section>
        <h2 className="section-label text-primary">Players</h2>
        <p className="mt-1 mb-2.5 text-sm font-semibold text-muted-foreground">
          A join link binds a player&apos;s device. Rotating a link kills the
          old one.
        </p>
        <CreatePlayerForm />
        {players.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-muted-foreground">
            No players yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
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
      </section>

      <section>
        <h2 className="section-label mb-2.5 text-primary">Settings</h2>
        <div className="border p-3.5">
          <NamePickerToggle enabled={settings.namePickerEnabled} />
        </div>
      </section>
    </main>
  );
}
