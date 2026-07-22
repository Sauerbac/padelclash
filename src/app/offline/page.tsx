import { OfflineMatchEntry } from "@/components/offline-match-entry";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader kicker="No connection" title="Log Match" />
      <OfflineMatchEntry />
    </main>
  );
}
