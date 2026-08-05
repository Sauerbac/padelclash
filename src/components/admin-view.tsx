import Link from "next/link";
import { logoutAction as realLogoutAction } from "@/app/actions/admin";
import {
  AdminLogin,
  type AdminLoginAction,
} from "@/components/admin/admin-login";
import {
  PlayerManagement,
  type CreatePlayer,
} from "@/components/admin/player-management";
import {
  DatabaseBackupControl,
  type DatabaseBackupState,
  type DownloadDatabaseBackup,
} from "@/components/admin/database-backup-control";
import {
  GeneralLinkControl,
  type GeneralLinkActions,
} from "@/components/admin/general-link-control";
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
          <Button asChild variant="outline" size="xs">
            <Link href="/">Back to app</Link>
          </Button>
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

      <PlayerManagement
        roster={props.roster}
        createPlayer={props.actions?.createPlayer}
        actions={props.actions?.playerRow}
        initialSearch={props.initialRosterSearch}
        initialExpandedPlayerId={props.initialExpandedPlayerId}
      />

      <section>
        <h2 className="section-label text-primary">Admin tools</h2>
        <div className="mt-2.5 space-y-4 border p-3.5">
          <DatabaseBackupControl
            download={props.actions?.downloadBackup}
            initialState={props.initialBackupState}
          />
          <div className="border-t pt-3">
            <form action={logoutAction}>
              <Button variant="outline" type="submit" className="text-muted-foreground">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
