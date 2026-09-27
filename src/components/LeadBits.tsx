import clsx from "clsx";
import { Flame, Snowflake, Sun, Minus, Clock } from "lucide-react";
import type { LeadIntent, LeadLevel } from "../lib/api";

export const LEAD_LEVELS: Record<LeadLevel, { label: string; icon: typeof Flame; chip: string; dot: string; tile: string }> = {
  hot: { label: "Hot", icon: Flame, chip: "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm shadow-rose-500/30", dot: "bg-rose-500", tile: "from-orange-500 to-rose-500" },
  warm: { label: "Warm", icon: Sun, chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", dot: "bg-amber-500", tile: "from-amber-400 to-orange-400" },
  cold: { label: "Cold", icon: Snowflake, chip: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300", dot: "bg-sky-500", tile: "from-sky-400 to-blue-500" },
  none: { label: "No action", icon: Minus, chip: "bg-surface-2 text-ink-3", dot: "bg-ink-3", tile: "from-slate-400 to-slate-500" },
};

export const INTENT_LABEL: Record<LeadIntent, string> = {
  order: "Wants to order",
  price: "Asked for price",
  catalogue: "Wants catalogue",
  stock: "Asked about stock",
  meeting: "Wants to meet",
  question: "Has a question",
  not_interested: "Not interested",
  thanks: "Said thanks",
  link: "Came from a lead link",
  other: "Wrote to you",
};

export function LeadBadge({ level, className, short }: { level: LeadLevel; className?: string; short?: boolean }) {
  const m = LEAD_LEVELS[level];
  const Icon = m.icon;
  return (
    <span className={clsx("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", m.chip, className)}>
      <Icon className="size-3" />
      {!short && m.label}
    </span>
  );
}

/** "Waiting 3h" — red once it is past the alert time the business set. */
export function WaitingChip({ since, alertHours, now = Date.now() }: { since: number; alertHours: number; now?: number }) {
  const mins = Math.max(0, Math.round((now - since) / 60000));
  const late = mins >= alertHours * 60;
  const text = mins < 60 ? `${mins}m` : mins < 48 * 60 ? `${Math.floor(mins / 60)}h${mins % 60 && mins < 600 ? ` ${mins % 60}m` : ""}` : `${Math.floor(mins / 1440)}d`;
  return (
    <span className={clsx("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", late ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-2")}>
      <Clock className="size-3" />
      Waiting {text}
    </span>
  );
}

export function money(inr: number, usd: number) {
  const r = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(inr);
  const d = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: usd < 100 ? 2 : 0 }).format(usd);
  return { inr: r, usd: d };
}
