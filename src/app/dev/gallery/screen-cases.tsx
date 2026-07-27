import { ADMIN_CASES } from "./cases/admin";
import { EDIT_CASES } from "./cases/edit";
import { JOIN_CASES } from "./cases/join";
import { LEADERBOARD_CASES } from "./cases/leaderboard";
import { LOG_CASES } from "./cases/log";
import { PLAYER_CASES } from "./cases/player";

export { ADMIN_ENTRY_BY_STATUS } from "./cases/admin";
export { INVITATION_CASES } from "./cases/join";

export type MainGallerySection =
  | "log"
  | "leaderboard"
  | "player"
  | "edit"
  | "join"
  | "admin";

export interface ScreenCase {
  title: string;
  note: string;
  render: () => React.ReactNode;
}

interface ScreenGallery {
  title: string;
  docs: string;
  intro: string;
  cases: Record<string, ScreenCase>;
}

export const SCREEN_GALLERIES: Record<MainGallerySection, ScreenGallery> = {
  log: {
    title: "Log Match",
    docs: "docs/ui/log-match.md",
    intro: "The logging surface with a real MatchForm and database-free roster fixtures.",
    cases: LOG_CASES,
  },
  leaderboard: {
    title: "Leaderboard",
    docs: "docs/ui/leaderboard.md",
    intro: "Empty, early-circle and full standings through the production ranking view.",
    cases: LEADERBOARD_CASES,
  },
  player: {
    title: "Player Detail",
    docs: "docs/ui/player-detail.md",
    intro: "Complete, Retired and no-history profiles derived entirely from fixtures.",
    cases: PLAYER_CASES,
  },
  edit: {
    title: "Edit Match",
    docs: "docs/ui/edit-match.md",
    intro: "The shared prefilled Match form and its permission-locked alternative.",
    cases: EDIT_CASES,
  },
  join: {
    title: "Join / Bind Device",
    docs: "docs/ui/join-bind.md",
    intro: "Both invitation kinds and every closed InvitationState lifecycle outcome.",
    cases: JOIN_CASES,
  },
  admin: {
    title: "Admin",
    docs: "docs/ui/admin-login.md and docs/ui/admin-panel.md",
    intro: "Signed-out authentication and roster management across every PlayerStatus.",
    cases: ADMIN_CASES,
  },
};

export const screenCaseHref = (section: MainGallerySection, id: string) =>
  `/dev/gallery/${section}/case/${id}`;

export function isMainGallerySection(
  value: string,
): value is MainGallerySection {
  return value in SCREEN_GALLERIES;
}
