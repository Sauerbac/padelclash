import { PageHeader } from "@/components/page-header";

type ScreenSkeletonKind = "feed" | "leaderboard" | "player" | "edit";

const labels: Record<ScreenSkeletonKind, string> = {
  feed: "Feed",
  leaderboard: "Rankings",
  player: "Player profile",
  edit: "Edit Match",
};

function SkeletonLine({ className }: { className: string }) {
  return <div className={`bg-muted ${className}`} />;
}

function PlayerSkeleton() {
  return (
    <>
      <header>
        <SkeletonLine className="h-3 w-28" />
        <SkeletonLine className="mt-3 h-12 w-3/4" />
      </header>
      <div className="grid grid-cols-3 divide-x border">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex flex-col items-center py-3.5">
            <SkeletonLine className="h-8 w-12" />
            <SkeletonLine className="mt-2 h-2.5 w-14" />
          </div>
        ))}
      </div>
      <section className="border p-3.5">
        <div className="flex justify-between">
          <SkeletonLine className="h-3 w-24" />
          <SkeletonLine className="h-3 w-10" />
        </div>
        <SkeletonLine className="mt-5 h-36 w-full" />
      </section>
      <SkeletonLine className="h-3 w-28" />
      <div className="space-y-3">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="border p-4">
            <SkeletonLine className="h-3 w-24" />
            <SkeletonLine className="mt-4 h-6 w-3/4" />
            <SkeletonLine className="mt-3 h-4 w-1/2" />
          </div>
        ))}
      </div>
    </>
  );
}

function EditSkeleton() {
  return (
    <>
      <PageHeader kicker="Corrections desk" title="Edit Match" />
      <section className="space-y-5 border p-4">
        <SkeletonLine className="h-3 w-20" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonLine className="h-11 w-full" />
          <SkeletonLine className="h-11 w-full" />
        </div>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index}>
            <SkeletonLine className="h-3 w-24" />
            <SkeletonLine className="mt-2 h-11 w-full" />
          </div>
        ))}
        <SkeletonLine className="h-12 w-full" />
      </section>
    </>
  );
}

export function ScreenSkeleton({ kind }: { kind: ScreenSkeletonKind }) {
  const label = labels[kind];

  return (
    <main
      aria-busy="true"
      aria-label={`Loading ${label}`}
      className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10"
    >
      <span className="sr-only" role="status" aria-live="polite">
        Loading {label}
      </span>
      <div className="contents motion-reduce:[&_*]:animate-none [&_.bg-muted]:animate-pulse">
        {kind === "player" ? (
          <PlayerSkeleton />
        ) : kind === "edit" ? (
          <EditSkeleton />
        ) : (
          <>
            <PageHeader
              kicker={kind === "feed" ? "Your club. Your receipts." : "The pecking order"}
              title={kind === "feed" ? "PadelClash" : "Rankings"}
            />
            <div className="space-y-3">
              {Array.from({ length: kind === "feed" ? 3 : 5 }, (_, index) => (
                <div
                  key={index}
                  className="border p-4"
                  style={{ minHeight: kind === "feed" ? 132 : 58 }}
                >
                  <SkeletonLine className="h-3 w-24" />
                  <SkeletonLine className="mt-4 h-6 w-3/4" />
                  <SkeletonLine className="mt-3 h-4 w-1/2" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
