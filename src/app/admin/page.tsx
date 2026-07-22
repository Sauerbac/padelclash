import { logoutAction } from "@/app/actions/admin";
import { AdminLogin } from "@/components/admin/admin-login";
import { CreatePlayerForm } from "@/components/admin/create-player-form";
import { GeneralLinkControl } from "@/components/admin/general-link-control";
import { PageHeader } from "@/components/page-header";
import { PlayerRow } from "@/components/admin/player-row";
import { Button } from "@/components/ui/button";
import { isAdmin } from "@/services/auth/admin";
import { getDb } from "@/services/db";
import { getGeneralLink } from "@/services/onboarding";
import { getAdminRoster, type RosterEntry } from "@/services/players";

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
  const now = new Date();
  const [roster, generalLink] = await Promise.all([
    getAdminRoster(db, now),
    getGeneralLink(db),
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
        <h2 className="section-label text-primary">Onboarding</h2>
        <div className="mt-2.5">
          <GeneralLinkControl
            link={generalLink}
            msRemaining={
              generalLink
                ? generalLink.expiresAt.getTime() - now.getTime()
                : null
            }
          />
        </div>
      </section>

      <section>
        <h2 className="section-label text-primary">Add a player</h2>
        <p className="mt-1 mb-2.5 text-sm font-semibold text-muted-foreground">
          New players start not joined, with no invite until you make one.
        </p>
        <CreatePlayerForm />
      </section>

      {/* The three groups of spec decision 50. */}
      <Group
        title="Joined"
        blurb="Holding an active device binding."
        entries={roster.joined}
        empty="Nobody has joined yet."
      />
      <Group
        title="Not joined"
        blurb="On the roster, waiting for an invite."
        entries={roster.notJoined}
        empty="Everyone on the roster has joined."
      />
      <Group
        title="Retired"
        blurb="Out of the pickers; history and name preserved."
        entries={roster.retired}
        empty="No retired players."
      />
    </main>
  );
}

function Group({
  title,
  blurb,
  entries,
  empty,
}: {
  title: string;
  blurb: string;
  entries: RosterEntry[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="section-label text-primary">
        {title} ({entries.length})
      </h2>
      <p className="mt-1 mb-2.5 text-sm font-semibold text-muted-foreground">
        {blurb}
      </p>
      {entries.length === 0 ? (
        <p className="text-sm font-semibold text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <PlayerRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}
