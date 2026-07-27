import { requireDevEnvironment } from "./guard";

/**
 * One gate in front of every `/dev/*` route (spec decision 126). A layout is
 * the right seam because Next renders it around every nested page, including
 * during `next build` — which runs with `NODE_ENV=production`, so the whole
 * subtree prerenders as a 404 rather than shipping as reachable pages.
 *
 * It adds no chrome. `/dev/gallery` draws its own navigation out of plain HTML,
 * and the screen-case routes must render exactly the app shell they are
 * reviewing and nothing else.
 */
export default function DevLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  requireDevEnvironment();
  return children;
}
