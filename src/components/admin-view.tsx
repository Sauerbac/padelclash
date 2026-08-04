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
  DatabaseBackupControl,
  type DatabaseBackupState,
  type DownloadDatabaseBackup,
} from "@/components/admin/database-backup-control";
import {
  GeneralLinkControl,
  type GeneralLinkActions,
} from "@/components/admin/general-link-control";
import { AdminRoster } from "@/components/admin/admin-roster";
import type { PlayerRowActions } from "@/components/admin/player-row";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import type { LinkDetails } from "@/services/onboarding";
import type { AdminRoster as AdminRosterData } from "@/services/players";

export interface AdminViewActions {
  login?: AdminLoginAction;
  logout?: () => Promise<void>;
  createPlayer?: CreatePlayer;
  generalLink?: GeneralLinkActions;
  playerRow?: PlayerRowActions;
  downloadBackup?: DownloadDatabaseBackup;
}

type AdminViewProps =
  | { state: "login" }
  | {
      state: "panel";
      roster: AdminRosterData;
      generalLink: LinkDetails | null;
      now: Date;
      initialRosterSearch?: string;
      initialExpandedPlayerId?: string | null;
      initialBackupState?: DatabaseBackupState;
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

      <AdminRoster
        roster={props.roster}
        actions={props.actions?.playerRow}
        initialSearch={props.initialRosterSearch}
        initialExpandedPlayerId={props.initialExpandedPlayerId}
      />

      <section>
        <h2 className="section-label text-primary">Database backup</h2>
        <div className="mt-2.5">
          <DatabaseBackupControl
            download={props.actions?.downloadBackup}
            initialState={props.initialBackupState}
          />
        </div>
      </section>
    </main>
  );
}
