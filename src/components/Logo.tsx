import clsx from "clsx";

/** A faceted diamond on the brand gradient, and the business name. */
export function Logo({ name, compact, className, onDark }: { name?: string; compact?: boolean; className?: string; onDark?: boolean }) {
  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <span className="bg-brand-gradient glow-brand flex size-9 items-center justify-center rounded-xl text-white">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeLinejoin="round" aria-hidden>
          <path d="M5 9.5 8.2 5h7.6L19 9.5 12 20z" strokeWidth="1.7" />
          <path d="M5 9.5h14M9.8 9.5 12 20l2.2-10.5M8.2 5l1.6 4.5L12 5l2.2 4.5L15.8 5" strokeWidth="1.1" opacity=".75" />
        </svg>
      </span>
      <div className="min-w-0 leading-tight">
        <div className={clsx("truncate font-display font-extrabold tracking-tight", onDark ? "text-white" : "text-ink", compact ? "text-[17px]" : "text-[18px]")}>{name || "Starlink Jewels"}</div>
        {!compact && <div className={clsx("text-[10.5px] font-semibold uppercase tracking-[0.16em]", onDark ? "text-violet-200/80" : "text-brand-text")}>WhatsApp Studio</div>}
      </div>
    </div>
  );
}
