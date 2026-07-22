import Image from "next/image";
import { canModifyMatch } from "@/domain/edit-rights";
import { MatchCard } from "@/components/match-card";
import { NotJoined } from "@/components/not-joined";
import { PageHeader } from "@/components/page-header";
import { QueuedMatches } from "@/components/queued-matches";
import { viewerForPrivateRead } from "@/services/auth/authz";
import { getDb } from "@/services/db";
import { getFeed } from "@/services/matches";

export default async function FeedPage() {
  // Before any query: an unbound visitor must not reach the match log, not
  // even into this response's payload (spec decision 33).
  const access = await viewerForPrivateRead();
  if (!access) return <NotJoined />;

  const { player: you, isAdmin } = access;
  const feed = await getFeed(getDb());
  const viewer = { playerId: you?.id ?? null, isAdmin };
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader
        kicker="Your club. Your receipts."
        title="PadelClash"
        actions={
          <Image
            src="/logo.svg"
            alt=""
            width={72}
            height={72}
            priority
            unoptimized
            className="shrink-0"
          />
        }
      />

      {you ? (
        <p className="text-[15px] font-semibold text-muted-foreground">
          Logging as <span className="text-accent uppercase">{you.name}</span>{" "}
          — new matches from this device are credited to you.
        </p>
      ) : (
        // The only way to be here unbound is an Admin session browsing past
        // the read gate (spec decision 49) — and Admin can't log a match.
        <p className="text-[15px] font-semibold text-muted-foreground">
          Viewing as admin. Logging a match needs a joined player on this
          device.
        </p>
      )}

      <QueuedMatches />

      {feed.length === 0 ? (
        <p className="text-[15px] font-semibold text-muted-foreground">
          No matches yet — log the first one.
        </p>
      ) : (
        <div className="space-y-3">
          {feed.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              canModify={canModifyMatch(match, viewer, now)}
              showLogger={isAdmin}
            />
          ))}
        </div>
      )}
    </main>
  );
}
