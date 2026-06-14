// App-shell chrome: the persistent group-context header (screens.md §0 — the
// current group is always-visible context inside the app). It lives in the `app`
// layer beside the TabBar, not in `src/ui`, because "which group am I in" is a
// route/shell concern, not a reusable presentational primitive. Composed from
// tokens only, keeping the ui fence strict (binding §2).
//
// A group switcher and avatar are deferred — see open-question 06.

export function GroupHeader({ name }: { name: string }) {
  return (
    <header className="flex flex-col gap-1 border-b-2 border-ink px-6 pt-12 pb-4">
      <span className="font-mono text-meta font-bold uppercase tracking-wide text-secondary">
        Group
      </span>
      <h1 className="font-display text-heading text-ink">{name}</h1>
    </header>
  );
}
