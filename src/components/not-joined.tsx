import Image from "next/image";
import Link from "next/link";
import { InvitationEntry } from "@/components/invitation-entry";
import { QueuedMatches } from "@/components/queued-matches";

/**
 * What an installation without a valid Device Binding sees instead of the tab
 * shell (spec decision 33). An installed PWA can transfer an Admin-issued
 * invitation into its own cookie context here, but still cannot mint or
 * discover access by itself (decision 87).
 *
 * It carries the offline queue anyway. A device whose binding was just revoked
 * may still hold matches it logged before losing access, and the guarantee is
 * that those only leave the device when someone presses Discard (decision 26)
 * — which is impossible if the only screen showing them is behind the gate.
 * It exposes nothing new: those matches were written on this device, from its
 * own IndexedDB, and an empty queue renders nothing at all.
 */
export function NotJoined() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-5 py-10">
      <div className="border px-5 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="kicker">Members only</p>
            <h1 className="mt-2.5 font-display text-[44px] leading-[1.05] uppercase">
              Not joined
            </h1>
          </div>
          <Image
            src="/logo.svg"
            alt=""
            width={64}
            height={64}
            priority
            unoptimized
            className="shrink-0 opacity-40"
          />
        </div>

        <p className="mt-3 text-base leading-normal font-semibold text-muted-foreground">
          This device isn&apos;t joined to the circle, so matches, rankings and
          player stats stay private.
        </p>
        <p className="mt-3 text-base leading-normal font-semibold text-muted-foreground">
          Getting in takes an invite link from the group admin. This screen
          can&apos;t create access on its own.
        </p>

        <InvitationEntry />

        <p className="mt-5 border-t border-hairline pt-4 text-sm font-semibold text-muted-foreground">
          Are you the admin?{" "}
          <Link href="/admin" className="text-accent underline">
            Log in
          </Link>
        </p>
      </div>

      <QueuedMatches />
    </main>
  );
}
