import { TabBar } from "@/components/tab-bar";

/**
 * The three-tab chrome: a content column sized to its children, with the
 * bottom bar's occupied height reserved beneath it.
 *
 * Separate from `(tabs)/layout.tsx` because the gallery's screen cases live at
 * `/dev/…`, outside that route group, and would otherwise review Feed with no
 * tab bar at all (decision 127). The layout keeps the read gate; this keeps the
 * geometry, so there is one definition of the shell rather than two that drift.
 */
export function TabShell({
  children,
  /** Route to mark active — only the gallery passes it. See `TabBar`. */
  pathname,
}: {
  children: React.ReactNode;
  pathname?: string;
}) {
  return (
    // `shrink-0`, not `flex-1`: as a flex child of #scroll-root, `min-h-full`
    // (min-height: 100%) replaces the automatic minimum size, so a growable
    // item collapses to the viewport and its content merely overflows —
    // dragging the tab-bar reserve below up with it, out of reach of the
    // scroller. Sizing to content and growing only via min-height fixes both.
    <div className="flex min-h-full shrink-0 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      {children}
      <TabBar pathname={pathname} />
    </div>
  );
}
