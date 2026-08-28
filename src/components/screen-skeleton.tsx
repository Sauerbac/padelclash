import { PageHeader } from "@/components/page-header";

export function ScreenSkeleton({ kind }: { kind: "feed" | "leaderboard" }) {
  return (
    <main
      aria-busy="true"
      aria-label={`Loading ${kind === "feed" ? "Feed" : "Rankings"}`}
      className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10"
    >
      <span className="sr-only" role="status" aria-live="polite">
        Loading {kind === "feed" ? "Feed" : "Rankings"}
      </span>
      <PageHeader
        kicker={kind === "feed" ? "Your club. Your receipts." : "The pecking order"}
        title={kind === "feed" ? "PadelClash" : "Rankings"}
      />
      <div className="space-y-3 motion-reduce:[&_*]:animate-none">
        {Array.from({ length: kind === "feed" ? 3 : 5 }, (_, index) => (
          <div
            key={index}
            className="animate-pulse border p-4"
            style={{ minHeight: kind === "feed" ? 132 : 58 }}
          >
            <div className="h-3 w-24 bg-muted" />
            <div className="mt-4 h-6 w-3/4 bg-muted" />
            <div className="mt-3 h-4 w-1/2 bg-muted" />
          </div>
        ))}
      </div>
    </main>
  );
}
