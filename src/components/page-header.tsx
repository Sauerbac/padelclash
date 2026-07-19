/**
 * Page heading (design "PageHeader"): mono gold kicker, Anton title, short
 * primary-red rule. The kicker carries the trash talk — titles stay
 * functional. `actions` renders bottom-aligned to the right of the title
 * (e.g. the admin panel's log-out button).
 */
export function PageHeader({
  kicker,
  title,
  actions,
}: {
  kicker: string;
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <header>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="kicker">{kicker}</p>
          <h1 className="mt-1.5 font-display text-[44px] leading-none tracking-[1px] uppercase">
            {title}
          </h1>
        </div>
        {actions}
      </div>
      <div aria-hidden className="mt-3 h-[3px] w-16 bg-primary" />
    </header>
  );
}
