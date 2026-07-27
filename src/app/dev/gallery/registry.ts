export const GALLERY_SECTIONS = [
  { id: "overview", href: "/dev/gallery", label: "Overview" },
  { id: "ds", href: "/dev/gallery/ds", label: "Design system" },
  { id: "feed", href: "/dev/gallery/feed", label: "Feed" },
  { id: "log", href: "/dev/gallery/log", label: "Log Match" },
  {
    id: "leaderboard",
    href: "/dev/gallery/leaderboard",
    label: "Leaderboard",
  },
  {
    id: "player",
    href: "/dev/gallery/player",
    label: "Player Detail",
  },
  { id: "edit", href: "/dev/gallery/edit", label: "Edit Match" },
  { id: "join", href: "/dev/gallery/join", label: "Join / Bind" },
  { id: "admin", href: "/dev/gallery/admin", label: "Admin" },
] as const;

export type GallerySectionId = (typeof GALLERY_SECTIONS)[number]["id"];
