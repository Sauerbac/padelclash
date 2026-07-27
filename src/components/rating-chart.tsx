"use client";

import { useRef, useState } from "react";
import { formatRatingDelta } from "@/lib/rating-format";

export interface RatingChartPoint {
  /** Local-formatted date label, e.g. "9 Jul" ("Start" for the baseline). */
  label: string;
  rating: number;
  /** Rating change of this point's match; null on the baseline point. */
  delta: number | null;
}

// Round rating gridlines: the smallest step that covers the span in ≤ 4 bands.
function ticksFor(min: number, max: number): number[] {
  const span = Math.max(max - min, 1);
  const step =
    [5, 10, 20, 25, 50, 100, 200, 500].find((s) => span / s <= 4) ?? 1000;
  const ticks: number[] = [];
  for (
    let v = Math.floor(min / step) * step;
    v <= Math.ceil(max / step) * step;
    v += step
  ) {
    ticks.push(v);
  }
  return ticks;
}

/**
 * The rating-over-time line (spec "Player Detail"), hand-rolled SVG — one
 * series needs no chart library. The plot is percentage-scaled SVG (marks
 * only); dots, labels, crosshair and tooltip are HTML so text never distorts.
 * Every value here is also readable in the match history below the chart.
 */
export function RatingChart({ points }: { points: RatingChartPoint[] }) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const ticks = ticksFor(
    Math.min(...points.map((p) => p.rating)),
    Math.max(...points.map((p) => p.rating)),
  );
  const [lo, hi] = [ticks[0], ticks[ticks.length - 1]];
  const x = (i: number) => (i / (points.length - 1)) * 100;
  const y = (rating: number) => ((hi - rating) / (hi - lo)) * 100;
  const coords = points.map((p, i) => ({ ...p, x: x(i), y: y(p.rating) }));
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const last = coords[coords.length - 1];
  // Sparse series get a dot per match; dense ones keep just the endpoint.
  const dotted = points.length <= 30 ? coords : [last];

  function nearest(e: React.PointerEvent) {
    const rect = plotRef.current!.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    setActive(
      Math.max(0, Math.min(points.length - 1, Math.round(frac * (points.length - 1)))),
    );
  }

  return (
    <div>
      <div
        ref={plotRef}
        className="relative mx-2 h-40"
        onPointerMove={nearest}
        onPointerLeave={() => setActive(null)}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {ticks.map((t) => (
            <line
              key={t}
              x1="0"
              y1={y(t)}
              x2="100"
              y2={y(t)}
              className="stroke-border"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polyline
            points={line}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {ticks.slice(1, -1).map((t) => (
          <span
            key={t}
            className="absolute left-0 -translate-y-full pb-0.5 font-mono text-[10px] font-medium text-muted-foreground"
            style={{ top: `${y(t)}%` }}
          >
            {t}
          </span>
        ))}

        {active !== null && (
          <div
            aria-hidden
            className="absolute inset-y-0 w-px bg-muted-foreground/40"
            style={{ left: `${coords[active].x}%` }}
          />
        )}

        {/* Gold match dots; the endpoint dot is primary red. */}
        {dotted.map((c) => (
          <span
            key={c.x}
            aria-hidden
            className={`absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_2px_var(--background)] ${
              c === last ? "bg-primary" : "bg-[var(--chart-1)]"
            }`}
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
          />
        ))}

        {/* Keyboard/touch hit targets, one per point, bigger than the marks. */}
        {coords.map((c, i) => (
          <button
            key={c.x}
            type="button"
            aria-label={`${c.label}: rating ${c.rating}`}
            className="absolute size-6 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          />
        ))}

        {active !== null && (
          <div
            className="pointer-events-none absolute z-10 border bg-popover px-2 py-1 text-popover-foreground"
            style={{
              left: `${coords[active].x}%`,
              top: `${coords[active].y - 6}%`,
              transform: `translate(${coords[active].x > 66 ? "-100%" : coords[active].x < 33 ? "0" : "-50%"}, -100%)`,
            }}
          >
            <div className="font-mono text-sm font-semibold tabular-nums">
              {coords[active].rating}
              {coords[active].delta !== null && (
                <span
                  className={`ml-1 font-medium ${
                    coords[active].delta >= 0
                      ? "text-win"
                      : "text-destructive"
                  }`}
                >
                  {formatRatingDelta(coords[active].delta)}
                </span>
              )}
            </div>
            <div className="font-mono text-[11px] font-medium text-muted-foreground uppercase">
              {coords[active].label}
            </div>
          </div>
        )}
      </div>

      <div className="mx-2 mt-2 flex justify-between font-mono text-[11px] font-medium text-muted-foreground uppercase">
        <span>{points[0].label}</span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}
