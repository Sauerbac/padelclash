import Link from "next/link";
import { logoutAction as realLogoutAction } from "@/app/actions/admin";
import {
  AdminLogin,
  type AdminLoginAction,
} from "@/components/admin/admin-login";
import {
  CreatePlayerForm,
  type CreatePlayer,
} from "@/components/admin/create-player-form";
import {
  GeneralLinkControl,
  type GeneralLinkActions,
} from "@/components/admin/general-link-control";
import {
  PlayerRow,
  type PlayerRowActions,
} from "@/components/admin/player-row";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import type { LinkDetails } from "@/services/onboarding";
import type { AdminRoster, RosterEntry } from "@/services/players";

export interface AdminViewActions {
  login?: AdminLoginAction;
  logout?: () => Promise<void>;
  createPlayer?: CreatePlayer;
  generalLink?: GeneralLinkActions;
  playerRow?: PlayerRowActions;
}

type AdminViewProps =
  | { state: "login" }
  | {
      state: "panel";
      roster: AdminRoster;
      generalLink: LinkDetails | null;
      now: Date;
    };

export function AdminView(
  props: AdminViewProps & { actions?: AdminViewActions },
) {
  if (props.state === "login") {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <AdminLogin login={props.actions?.login} />
      </main>
    );
  }

  const logoutAction = props.actions?.logout ?? realLogoutAction;
  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader
        kicker="The commissioner"
        title="Admin"
        actions={
          <div className="flex items-center gap-1.5">
            <Button asChild variant="outline" size="xs">
              <Link href="/">Back to app</Link>
            </Button>
            <form action={logoutAction} className="flex">
              <Button
                variant="outline"
                size="xs"
                type="submit"
                className="text-muted-foreground"
              >
                Log out
              </Button>
            </form>
          </div>
        }
      />

      <section>
        <h2 className="section-label text-primary">Onboarding</h2>
        <div className="mt-2.5">
          <GeneralLinkControl
            link={props.generalLink}
            msRemaining={
              props.generalLink
                ? props.generalLink.expiresAt.getTime() - props.now.getTime()
                : null
            }
            actions={props.actions?.generalLink}
          />
        </div>
      </section>

      <section>
        <h2 className="section-label text-primary">Add a player</h2>
        <p className="mt-1 mb-2.5 text-sm font-semibold text-muted-foreground">
          New players start not joined, with no invite until you make one.
        </p>
        <CreatePlayerForm createPlayer={props.actions?.createPlayer} />
      </section>

      <Group
        title="Joined"
        blurb="Holding an active device binding."
        entries={props.roster.joined}
        empty="Nobody has joined yet."
        actions={props.actions?.playerRow}
      />
      <Group
        title="Not joined"
        blurb="On the roster, waiting for an invite."
        entries={props.roster.notJoined}
        empty="Everyone on the roster has joined."
        actions={props.actions?.playerRow}
      />
      <Group
        title="Retired"
        blurb="Out of the pickers; history and name preserved."
        entries={props.roster.retired}
        empty="No retired players."
        actions={props.actions?.playerRow}
      />
    </main>
  );
}

function Group({
  title,
  blurb,
  entries,
  empty,
  actions,
}: {
  title: string;
  blurb: string;
  entries: RosterEntry[];
  empty: string;
  actions?: PlayerRowActions;
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
            <PlayerRow key={entry.id} entry={entry} actions={actions} />
          ))}
        </ul>
      )}
    </section>
  );
}
