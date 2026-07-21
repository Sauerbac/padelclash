import Link from "next/link";

/**
 * What an installation without a valid Device Binding sees instead of the tab
 * shell (spec decision 33). It is deliberately a dead end: there is no
 * self-service way in, because every route in needs Admin to issue an
 * invitation first.
 *
 * The frontend tranche owns dressing this up; what matters here is that it is
 * the *only* thing an unbound visitor can reach.
 */
export function NotJoined() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm border px-5 py-6">
        <h1 className="font-display text-3xl leading-[1.1] uppercase">
          Not joined
        </h1>
        <p className="mt-3 text-base leading-normal font-semibold text-muted-foreground">
          This device isn&apos;t joined to the circle, so matches, rankings and
          player stats stay private. Ask the group admin for an invite link.
        </p>
        <p className="mt-4 text-sm font-semibold text-muted-foreground">
          Admin?{" "}
          <Link href="/admin" className="text-accent underline">
            Log in
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
