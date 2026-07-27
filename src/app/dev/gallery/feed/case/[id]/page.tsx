import { notFound } from "next/navigation";
import { FEED_CASES } from "../../cases";

/**
 * One Feed case, alone on its route so an iframe can give it a real viewport.
 * No gallery chrome: everything this renders is the app under review. The case
 * supplies its own shell, because `/dev` is outside the `(tabs)` group.
 */
export default async function FeedCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const feedCase = FEED_CASES[id];
  if (!feedCase) notFound();
  return feedCase.render();
}

// No `generateStaticParams`. The ids are a fixed set, so prerendering them
// looks free — but the parent layout calls `notFound()` whenever NODE_ENV is
// "production", which is exactly the environment the prerender worker runs in.
// Every param would fail, and the route stays dynamic anyway.
