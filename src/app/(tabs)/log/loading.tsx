import { OfflineMatchEntry } from "@/components/offline-match-entry";
import { PageHeader } from "@/components/page-header";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 space-y-5 px-5 pt-6 pb-10">
      <PageHeader kicker="New match" title="Log Match" />
      <OfflineMatchEntry checkingRoster />
    </main>
  );
}
