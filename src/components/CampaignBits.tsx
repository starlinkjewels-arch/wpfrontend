import { Link } from "react-router";
import clsx from "clsx";
import { CalendarClock, CheckCircle2, CirclePause, CircleX, Clock3, FileEdit, Loader2, Paperclip, Send, Users, Hourglass } from "lucide-react";
import type { Campaign, CampaignStatus } from "../lib/api";
import { Badge, Progress } from "./ui";
import { friendlyWhen, num, pct, time } from "../lib/format";
import { useNow } from "../lib/hooks";

export const STATUS_META: Record<CampaignStatus, { label: string; tone: "neutral" | "brand" | "gold" | "danger" | "warn" | "info"; icon: typeof Send }> = {
  draft: { label: "Draft", tone: "neutral", icon: FileEdit },
  scheduled: { label: "Scheduled", tone: "info", icon: CalendarClock },
  queued: { label: "Waiting its turn", tone: "info", icon: Hourglass },
  running: { label: "Sending", tone: "brand", icon: Loader2 },
  paused: { label: "Paused", tone: "warn", icon: CirclePause },
  completed: { label: "Completed", tone: "neutral", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", tone: "danger", icon: CircleX },
};

export function StatusBadge({ status }: { status: CampaignStatus }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <Badge tone={m.tone}>
      <Icon className={clsx("size-3.5", status === "running" && "animate-spin [animation-duration:2s]")} />
      {m.label}
    </Badge>
  );
}

/** One line on what a live campaign is doing right now. */
export function WaitingLine({ c }: { c: Campaign }) {
  const now = useNow(1000);
  if (c.status === "running" && c.waiting) {
    const secs = c.waiting.until ? Math.max(0, Math.round((c.waiting.until - now) / 1000)) : null;
    if (c.waiting.code === "gap") return <span className="text-ink-3">Next message in {secs ?? "a few"}s</span>;
    if (c.waiting.code === "window" || c.waiting.code === "limit") {
      return <span className="text-warn">{c.waiting.reason} · resumes {c.waiting.until ? friendlyWhen(c.waiting.until) : "later"}</span>;
    }
    return <span className="text-danger">{c.waiting.reason}</span>;
  }
  if (c.status === "running") return <span className="text-brand-text">Sending now…</span>;
  if (c.status === "queued") return <span className="text-ink-3">Starts when the current campaign finishes</span>;
  if (c.status === "paused") return <span className="text-warn">{c.pausedReason || "Paused by you"}</span>;
  if (c.status === "scheduled") return <span className="text-ink-3">Sends {friendlyWhen(c.scheduledAt)}</span>;
  return null;
}

/** "Dear {{first_name|Sir}}, *new*" -> "Dear [first name], new" for a one-line summary. */
function readable(message: string) {
  return message
    .replace(/\{\{\s*([^}|]+?)\s*(\|[^}]*)?\}\}/g, (_m, k: string) => `[${k.replace(/_/g, " ")}]`)
    .replace(/\{([^{}]*\|[^{}]*)\}/g, (_m, opts: string) => opts.split("|")[0])
    .replace(/(^|\s)[*_~]([^*_~\n]+)[*_~]/g, "$1$2");
}

export function CampaignCard({ c }: { c: Campaign }) {
  const s = c.stats;
  const done = s ? s.sent + s.failed + s.skipped : 0;
  const total = s?.total ?? c.audienceCount ?? 0;
  const live = ["running", "queued", "paused"].includes(c.status);
  return (
    <Link to={c.status === "draft" ? `/campaigns/${c.id}/edit` : `/campaigns/${c.id}`} className="group block">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card transition-all group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:shadow-pop">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-ink">{c.name}</h3>
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-3">{readable(c.message) || (c.media ? c.media.name : "—")}</p>
          </div>
          <StatusBadge status={c.status} />
        </div>
        {live && s ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span className="font-semibold text-ink">
                {num(done)} <span className="font-normal text-ink-3">of {num(total)}</span>
              </span>
              <span className="text-ink-3">{pct(done, total)}%</span>
            </div>
            <Progress value={pct(done, total)} />
            <div className="mt-2 text-[12px]"><WaitingLine c={c} /></div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-3">
            <span className="flex items-center gap-1.5"><Users className="size-3.5" />{num(total)} clients</span>
            {c.status === "completed" && s && (
              <>
                <span className="flex items-center gap-1.5 text-brand-text"><CheckCircle2 className="size-3.5" />{num(s.sent)} sent</span>
                {s.failed > 0 && <span className="text-danger">{num(s.failed)} failed</span>}
              </>
            )}
            {c.status === "scheduled" && <span className="flex items-center gap-1.5 text-info"><Clock3 className="size-3.5" />{friendlyWhen(c.scheduledAt)}</span>}
            {c.status === "completed" && c.finishedAt && <span>Finished {friendlyWhen(c.finishedAt)}</span>}
            {c.status === "draft" && <span>Edited {time(c.updatedAt)}</span>}
            {c.media && <span className="flex items-center gap-1"><Paperclip className="size-3.5" />{c.media.kind}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
