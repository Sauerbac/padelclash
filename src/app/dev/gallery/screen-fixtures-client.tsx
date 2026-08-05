"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import type {
  EditMatchActionResult,
  LogMatchActionResult,
  PayoffDelta,
} from "@/app/actions/matches";
import { AdminLogin } from "@/components/admin/admin-login";
import type { AdminViewActions } from "@/components/admin-view";
import { AdminView } from "@/components/admin-view";
import { EditMatchView } from "@/components/edit-match-view";
import { JoinView } from "@/components/join-view";
import { LogMatchView } from "@/components/log-match-view";
import type {
  EditableMatch,
  MatchFormActions,
  MatchFormDraft,
} from "@/components/match-form";

const never = () => new Promise<never>(() => {});

const matchActions: MatchFormActions = {
  logMatch: async () => ({
    ok: false,
    code: "not-allowed",
    error: "Fixture action: no Match was written.",
  }),
  editMatch: async () => ({
    ok: false,
    code: "not-allowed",
    error: "Fixture action: no Match was changed.",
  }),
  enqueue: async () => {},
};

const adminActions: AdminViewActions = {
  login: async (state) => state,
  logout: async () => {},
  createPlayer: async () => ({}),
  generalLink: {
    generate: async () => ({
      ok: false,
      error: "Fixture action: no link was generated.",
    }),
    revoke: async () => ({ ok: true }),
  },
  playerRow: {
    rename: async () => ({}),
    generatePersonalLink: async () => ({
      ok: false,
      error: "Fixture action: no link was generated.",
    }),
    revokePersonalLink: async () => ({ ok: true }),
    revokeAccess: async () => ({ ok: true }),
    retire: async () => ({ ok: true }),
    restore: async () => ({ ok: true }),
    deletePlayer: async () => ({ ok: true }),
    getBindingHistory: async () => [],
  },
  downloadBackup: async () => {},
};

function AutoClick({
  selector,
  children,
}: {
  selector: string;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const driven = useRef(false);

  useEffect(() => {
    if (driven.current) return;
    driven.current = true;
    root.current?.querySelector<HTMLButtonElement>(selector)?.click();
  }, [selector]);

  return <div ref={root}>{children}</div>;
}

export function FixtureLogMatchView(
  props: ComponentProps<typeof LogMatchView>,
) {
  return <LogMatchView {...props} actions={matchActions} />;
}

export function FixtureLogActionState({
  scenario,
  payoff,
  initialDraft,
  ...props
}: Omit<ComponentProps<typeof LogMatchView>, "actions" | "initialDraft"> & {
  scenario: "pending" | "refused" | "success" | "offline";
  payoff: PayoffDelta[];
  initialDraft: MatchFormDraft;
}) {
  const result = (): Promise<LogMatchActionResult> => {
    if (scenario === "pending") return never();
    if (scenario === "offline") return Promise.reject(new Error("offline"));
    if (scenario === "success") {
      return Promise.resolve({
        ok: true,
        deltas: payoff,
        alreadyLogged: false,
      });
    }
    return Promise.resolve({
      ok: false,
      code: "invalid",
      error: "A Guest name can't match anyone already on the roster.",
    });
  };

  return (
    <AutoClick selector="[data-match-submit]">
      <LogMatchView
        {...props}
        initialDraft={initialDraft}
        actions={{
          ...matchActions,
          logMatch: result,
        }}
      />
    </AutoClick>
  );
}

export function FixtureEditMatchView(
  props: ComponentProps<typeof EditMatchView>,
) {
  if (props.state === "locked") return <EditMatchView {...props} />;
  return <EditMatchView {...props} actions={matchActions} />;
}

export function FixtureEditActionState({
  scenario,
  payoff,
  editing,
  ...props
}: {
  scenario: "pending" | "refused" | "success" | "offline";
  payoff: PayoffDelta[];
  editing: EditableMatch;
  roster: { id: string; name: string }[];
  reservedPlayerNames: string[];
}) {
  const result = (): Promise<EditMatchActionResult> => {
    if (scenario === "pending") return never();
    if (scenario === "offline") return Promise.reject(new Error("offline"));
    if (scenario === "success") {
      return Promise.resolve({ ok: true, deltas: payoff });
    }
    return Promise.resolve({
      ok: false,
      code: "not-allowed",
      error: "That match is locked now.",
    });
  };

  return (
    <AutoClick selector="[data-match-submit]">
      <EditMatchView
        state="editable"
        {...props}
        editing={editing}
        actions={{ ...matchActions, editMatch: result }}
      />
    </AutoClick>
  );
}

export function FixtureJoinView(props: ComponentProps<typeof JoinView>) {
  return (
    <JoinView
      {...props}
      confirmJoin={async () => ({
        ok: false,
        error: "rate-limited",
      })}
    />
  );
}

export function FixtureJoinActionState({
  scenario,
  ...props
}: Omit<ComponentProps<typeof JoinView>, "confirmJoin"> & {
  scenario: "pending" | "refused";
}) {
  return (
    <AutoClick selector="button">
      <JoinView
        {...props}
        confirmJoin={
          scenario === "pending"
            ? never
            : async () => ({ ok: false, error: "player-already-joined" })
        }
      />
    </AutoClick>
  );
}

export function FixtureGeneralConfirmation(
  props: Omit<ComponentProps<typeof JoinView>, "confirmJoin">,
) {
  return (
    <AutoClick selector="button">
      <JoinView
        {...props}
        confirmJoin={async () => ({ ok: false, error: "rate-limited" })}
      />
    </AutoClick>
  );
}

export function FixtureAdminView(props: ComponentProps<typeof AdminView>) {
  return <AdminView {...props} actions={adminActions} />;
}

export function FixtureAdminActionFailure(
  props: Extract<ComponentProps<typeof AdminView>, { state: "panel" }>,
) {
  return (
    <AutoClick selector='button[data-admin-action="rename"]'>
      <AdminView
        {...props}
        actions={{
          ...adminActions,
          playerRow: {
            ...adminActions.playerRow,
            rename: async () => ({ error: "Fixture action failed." }),
          },
        }}
      />
    </AutoClick>
  );
}

export function FixtureAdminLoginState({
  scenario,
}: {
  scenario: "pending" | "wrong-password" | "not-configured";
}) {
  const login =
    scenario === "pending"
      ? never
      : async () => ({
          error:
            scenario === "wrong-password"
              ? "Wrong password"
              : "Admin login is not configured.",
        });

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <AdminLogin
        login={login}
        initialPassword="fixture"
        autoSubmit
      />
    </main>
  );
}

export function FixtureAdminCreateError(
  props: Omit<
    Extract<ComponentProps<typeof AdminView>, { state: "panel" }>,
    "actions"
  >,
) {
  const root = useRef<HTMLDivElement>(null);
  const driven = useRef(false);

  useEffect(() => {
    if (driven.current) return;
    driven.current = true;
    const form = root.current?.querySelector<HTMLFormElement>(
      "[data-create-player]",
    );
    const input = form?.querySelector<HTMLInputElement>('input[name="name"]');
    if (!form || !input) return;
    input.value = " ";
    form.requestSubmit();
  }, []);

  return (
    <div ref={root}>
      <AdminView
        {...props}
        actions={{
          ...adminActions,
          createPlayer: async () => ({ error: "Name must not be blank" }),
        }}
      />
    </div>
  );
}

export function FixtureAdminCreateSuccess(
  props: Omit<
    Extract<ComponentProps<typeof AdminView>, { state: "panel" }>,
    "actions"
  > & { player: { id: string; name: string } },
) {
  const { player, ...viewProps } = props;
  const root = useRef<HTMLDivElement>(null);
  const driven = useRef(false);

  useEffect(() => {
    if (driven.current) return;
    driven.current = true;
    const form = root.current?.querySelector<HTMLFormElement>(
      "[data-create-player]",
    );
    const input = form?.querySelector<HTMLInputElement>('input[name="name"]');
    if (!form || !input) return;
    input.value = player.name;
    form.requestSubmit();
  }, [player.name]);

  return (
    <div ref={root}>
      <AdminView
        {...viewProps}
        actions={{
          ...adminActions,
          createPlayer: async () => ({ createdPlayers: [player] }),
        }}
      />
    </div>
  );
}
