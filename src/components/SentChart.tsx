import { useMemo, useRef, useState } from "react";
import type { Day } from "../lib/api";
import { num } from "../lib/format";

/**
 * Messages sent per day — one series, columns.
 *
 * Specs: columns capped at 24px with a 4px rounded top and square base,
 * hairline recessive grid, only the peak labelled, per-column hover tooltip
 * with hit targets the full column slot, and a table for screen readers.
 */
export function SentChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const H = 180;
  const PAD_TOP = 22;
  const PAD_BOTTOM = 26;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const { max, ticks, peak } = useMemo(() => {
    const raw = Math.max(4, ...days.map((d) => d.sent));
    const step = niceStep(raw / 3);
    const top = Math.ceil(raw / step) * step;
    const peakIdx = days.reduce((best, d, i) => (d.sent > days[best].sent ? i : best), 0);
    return { max: top, ticks: [0, step, step * 2, top].filter((v, i, a) => v <= top && a.indexOf(v) === i), peak: peakIdx };
  }, [days]);

  const n = days.length;
  const label = (d: Day) => new Date(d.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const weekday = (d: Day) => new Date(d.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "narrow" });

  return (
    <div ref={wrap} className="relative">
      <svg viewBox={`0 0 ${n * 40} ${H}`} className="h-[180px] w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label="Messages sent per day, last 14 days">
        {ticks.map((t) => {
          const y = PAD_TOP + plotH - (t / max) * plotH;
          return <line key={t} x1={0} x2={n * 40} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      {/* Columns as HTML so they keep true pixel widths and rounded tops at any width. */}
      <div className="absolute inset-x-0 flex items-end" style={{ top: PAD_TOP, height: plotH }}>
        {days.map((d, i) => {
          const h = d.sent ? Math.max(3, (d.sent / max) * plotH) : 0;
          const isToday = i === n - 1;
          return (
            <div
              key={d.date}
              className="relative flex h-full flex-1 items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${label(d)}: ${d.sent} sent`}
            >
              {hover === i && <div className="absolute inset-y-0 w-full max-w-[40px] rounded-md bg-surface-2" />}
              {i === peak && d.sent > 0 && (
                <span className="absolute text-[11px] font-semibold text-ink-2" style={{ bottom: h + 4 }}>
                  {num(d.sent)}
                </span>
              )}
              <div
                className="relative w-[62%] max-w-[24px] rounded-t-[4px] transition-[height] duration-500"
                style={{ height: h, background: "var(--chart)", opacity: hover == null || hover === i ? 1 : 0.55, outline: isToday ? "none" : undefined }}
              />
            </div>
          );
        })}
      </div>
      {/* x-axis labels */}
      <div className="absolute inset-x-0 bottom-0 flex">
        {days.map((d, i) => (
          <div key={d.date} className="flex-1 text-center text-[11px] text-ink-3">
            {i === n - 1 ? "Today" : i % 2 === 1 ? "" : weekday(d)}
          </div>
        ))}
      </div>
      {/* y-axis tick labels */}
      <div className="pointer-events-none absolute left-0" style={{ top: PAD_TOP, height: plotH }}>
        {ticks.slice(1).map((t) => (
          <span key={t} className="absolute -translate-y-full pb-0.5 text-[10px] text-ink-3" style={{ top: plotH - (t / max) * plotH }}>
            {num(t)}
          </span>
        ))}
      </div>
      {hover != null && (
        <div
          className="animate-fade pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 text-[12px] shadow-pop"
          style={{ left: `${((hover + 0.5) / n) * 100}%`, top: -8 }}
        >
          <div className="font-semibold text-ink">{label(days[hover])}</div>
          <div className="mt-1 flex items-center justify-between gap-4 text-ink-2">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: "var(--chart)" }} />Sent</span>
            <b className="text-ink">{num(days[hover].sent)}</b>
          </div>
          <div className="flex justify-between gap-4 text-ink-2"><span>Replies</span><b className="text-ink">{num(days[hover].inbound)}</b></div>
          {days[hover].failed > 0 && <div className="flex justify-between gap-4 text-ink-2"><span>Failed</span><b className="text-ink">{num(days[hover].failed)}</b></div>}
        </div>
      )}
      <table className="sr-only">
        <caption>Messages per day</caption>
        <thead>
          <tr><th>Date</th><th>Sent</th><th>Replies</th><th>Failed</th></tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}><td>{label(d)}</td><td>{d.sent}</td><td>{d.inbound}</td><td>{d.failed}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function niceStep(x: number) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(1, x)));
  const f = x / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}
