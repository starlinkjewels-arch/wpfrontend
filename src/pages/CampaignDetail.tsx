import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { ArrowLeft, Ban, CheckCircle2, Clock3, Copy, MoreHorizontal, Pause, Pencil, Play, RotateCcw, Search, Trash2, XCircle, CircleSlash, Users, CalendarClock, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { api, del, post, type Campaign, type Recipient } from "../lib/api";
import { useDebounced } from "../lib/hooks";
import { Badge, Button, Card, Loading, Menu, MenuItem, Segmented, useConfirm, Avatar } from "../components/ui";
import { StatusBadge, WaitingLine } from "../components/CampaignBits";
import { PhonePreview } from "../components/PhonePreview";
import { dateTime, friendlyWhen, num, pct, phone, time } from "../lib/format";

type RFilter = "all" | "sent" | "pending" | "failed" | "skipped";

export function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [rf, setRf] = useState<RFilter>("all");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);

  const { data: c, isLoading, error } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => api<Campaign>(`/campaigns/${id}`),
    // Fast while sending, and around the moment a scheduled one is due to start.
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return 5000;
      if (["running", "queued"].includes(d.status)) return 2000;
      if (d.status === "scheduled" && (d.scheduledAt ?? 0) < Date.now() + 60000) return 1500;
      return 8000;
    },
  });
  const live = c && ["running", "queued"].includes(c.status);
  // Any change in the counts means some client's line changed too.
  const version = c ? `${c.status}:${c.stats?.pending ?? "-"}:${c.stats?.failed ?? "-"}` : "";
  const recips = useQuery({
    queryKey: ["recipients", id, rf, dq, page, version],
    queryFn: () => api<{ items: Recipient[]; total: number; pageSize: number }>(`/campaigns/${id}/recipients?status=${rf}&q=${encodeURIComponent(dq)}&page=${page}&pageSize=50`),
    refetchInterval: live ? 3000 : false,
    placeholderData: keepPreviousData,
  });

  // The preview shows the message as the first client received it, not the raw {{placeholders}}.
  const rendered = useQuery({
    queryKey: ["render-detail", c?.message],
    queryFn: () => post<{ text: string; contact: { name: string } }>("/render", { message: c!.message }),
    enabled: Boolean(c?.message),
    staleTime: Infinity,
  });

  const act = useMutation({
    mutationFn: (action: "pause" | "resume" | "cancel" | "retry" | "duplicate") => post<Campaign & { count?: number }>(`/campaigns/${id}/${action}`),
    onSuccess: (res, action) => {
      qc.invalidateQueries({ queryKey: ["campaign", id] });
      qc.invalidateQueries({ queryKey: ["recipients", id] });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      if (action === "duplicate") {
        toast.success("Copied as a new draft");
        navigate(`/campaigns/${res.id}/edit`);
      } else {
        toast.success({ pause: "Paused", resume: "Resumed", cancel: "Cancelled", retry: `${num(res.count ?? 0)} messages queued again` }[action]);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => del(`/campaigns/${id}`),
    onSuccess: () => {
      toast.success("Campaign deleted");
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      navigate("/campaigns");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Loading />;
  if (error || !c) return <p className="py-20 text-center text-ink-3">Campaign not found. <Link className="text-brand-text underline" to="/campaigns">Back to campaigns</Link></p>;

  const s = c.stats ?? { total: c.audienceCount ?? 0, pending: c.audienceCount ?? 0, sent: 0, failed: 0, skipped: 0 };
  const done = s.sent + s.failed + s.skipped;
  const progress = pct(done, s.total);
  const canEdit = c.status === "draft" || c.status === "scheduled" || (c.status === "paused" && !c.materialized);
  const retryable = c.materialized && s.failed > 0 && c.status !== "running";

  return (
    <>
      <Link to="/campaigns" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> Campaigns
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[28px] font-medium leading-tight tracking-tight sm:text-[32px]">{c.name}</h1>
            <StatusBadge status={c.status} />
          </div>
          <p className="mt-1.5 text-sm text-ink-3">
            {c.startedAt ? <>Started {dateTime(c.startedAt)}</> : c.scheduledAt && c.status === "scheduled" ? <>Scheduled for {friendlyWhen(c.scheduledAt)}</> : <>Created {dateTime(c.createdAt)}</>}
            {c.finishedAt && <> · finished {dateTime(c.finishedAt)}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {c.ai?.personalize && (
            <Button variant="soft" icon={<Sparkles className="size-4" />} onClick={() => navigate(`/campaigns/${c.id}/review`)}>
              Each client's message
            </Button>
          )}
          {canEdit && <Button icon={<Pencil className="size-4" />} onClick={() => navigate(`/campaigns/${c.id}/edit`)}>Edit</Button>}
          {(c.status === "running" || c.status === "queued" || c.status === "scheduled") && (
            <Button icon={<Pause className="size-4" />} loading={act.isPending && act.variables === "pause"} onClick={() => act.mutate("pause")}>Pause</Button>
          )}
          {c.status === "paused" && (
            <Button variant="primary" icon={<Play className="size-4" />} loading={act.isPending && act.variables === "resume"} onClick={() => act.mutate("resume")}>Resume</Button>
          )}
          {retryable && (
            <Button variant="primary" icon={<RotateCcw className="size-4" />} loading={act.isPending && act.variables === "retry"} onClick={() => act.mutate("retry")}>Retry failed</Button>
          )}
          <Menu trigger={() => <Button variant="secondary" aria-label="More"><MoreHorizontal className="size-4" /></Button>}>
            {(close) => (
              <>
                <MenuItem icon={<Copy />} onClick={() => { close(); act.mutate("duplicate"); }}>Duplicate</MenuItem>
                {!["completed", "cancelled"].includes(c.status) && (
                  <MenuItem icon={<XCircle />} danger onClick={async () => {
                    close();
                    if (await confirm({ title: "Cancel this campaign?", body: `${num(s.pending)} clients who haven't received it yet will not get it. This can't be undone.`, confirm: "Cancel campaign", danger: true })) act.mutate("cancel");
                  }}>Cancel campaign</MenuItem>
                )}
                {c.status !== "running" && (
                  <MenuItem icon={<Trash2 />} danger onClick={async () => {
                    close();
                    if (await confirm({ title: "Delete this campaign?", body: "Its results will be removed. Messages already sent stay in your clients' chats.", confirm: "Delete", danger: true })) remove.mutate();
                  }}>Delete</MenuItem>
                )}
              </>
            )}
          </Menu>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* Progress */}
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[13px] font-medium text-ink-2">{c.materialized ? "Progress" : "Will be sent to"}</div>
                <div className="mt-1 text-[40px] font-semibold leading-none tracking-tight">
                  {c.materialized ? <>{progress}<span className="text-2xl text-ink-3">%</span></> : num(s.total)}
                </div>
              </div>
              <div className="text-right text-[13px]">
                <WaitingLine c={c} />
                {c.eta && c.status === "running" && <div className="mt-0.5 text-ink-3">Estimated finish {friendlyWhen(c.eta)}</div>}
                {c.note && <div className="text-ink-3">{c.note}</div>}
              </div>
            </div>
            {c.materialized && (
              <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${s.sent} sent, ${s.failed} failed, ${s.skipped} skipped of ${s.total}`}>
                <div className="bg-brand transition-all duration-500" style={{ width: `${pct(s.sent, s.total)}%` }} />
                {s.failed > 0 && <div className="border-l-2 border-surface bg-danger transition-all duration-500" style={{ width: `${pct(s.failed, s.total)}%` }} />}
                {s.skipped > 0 && <div className="border-l-2 border-surface bg-ink-3 transition-all duration-500" style={{ width: `${pct(s.skipped, s.total)}%` }} />}
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={<CheckCircle2 />} label="Sent" value={s.sent} color="bg-brand" />
              <Stat icon={<Clock3 />} label="Waiting" value={s.pending} color="bg-info" />
              <Stat icon={<XCircle />} label="Failed" value={s.failed} color="bg-danger" />
              <Stat icon={<CircleSlash />} label="Skipped" value={s.skipped} color="bg-ink-3" />
            </div>
            {c.status === "paused" && c.pausedReason && (
              <div className="mt-5 rounded-xl bg-warn-soft px-4 py-3 text-[13px] text-warn">{c.pausedReason}</div>
            )}
          </Card>

          {/* Recipients */}
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
              <div className="scroll-thin overflow-x-auto">
                <Segmented<RFilter>
                  value={rf}
                  onChange={(v) => { setRf(v); setPage(1); }}
                  options={[
                    { value: "all", label: "All", count: s.total },
                    { value: "sent", label: "Sent", count: s.sent },
                    { value: "pending", label: "Waiting", count: s.pending },
                    { value: "failed", label: "Failed", count: s.failed },
                    { value: "skipped", label: "Skipped", count: s.skipped },
                  ]}
                />
              </div>
              <div className="relative sm:ml-auto sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <input className="field h-9 pl-9" placeholder="Find a client" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
              </div>
            </div>
            <ul className="divide-y divide-line">
              {(recips.data?.items ?? []).map((r) => (
                <li key={r.phone} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={r.name} seed={r.phone} size={32} />
                  <Link to={`/inbox/${r.phone}`} className="min-w-0 flex-1 hover:underline">
                    <div className="truncate text-sm font-medium">{r.name || phone(r.phone)}</div>
                    <div className="truncate text-[12px] text-ink-3">{phone(r.phone)}{r.company && ` · ${r.company}`}</div>
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <RecipientBadge r={r} />
                    {r.error && r.status !== "sent" && <span className="max-w-[200px] truncate text-[11px] text-ink-3" title={r.error}>{r.error}</span>}
                    {r.at && r.status === "sent" && <span className="text-[11px] text-ink-3">{time(r.at)}</span>}
                  </div>
                </li>
              ))}
              {recips.data?.items.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-3">No clients here.</li>}
            </ul>
            {(recips.data?.total ?? 0) > 50 && (
              <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[13px] text-ink-3">
                <span>Page {page} of {Math.ceil(recips.data!.total / 50)}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="size-4" />}>Prev</Button>
                  <Button size="sm" variant="ghost" disabled={page * 50 >= recips.data!.total} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="size-4" /></Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <PhonePreview text={rendered.data?.text ?? c.message} media={c.media} contactName={rendered.data?.contact.name} />
          <Card className="space-y-2.5 p-4 text-[13px]">
            <Row icon={<Users />} label="Audience">
              {c.audience.mode === "all" ? "All clients" : c.audience.mode === "tags" ? `Tags: ${c.audience.tags.join(", ")}` : `${num(c.audience.contactIds.length)} picked clients`}
            </Row>
            {c.audience.excludeTags.length > 0 && <Row icon={<Ban />} label="Left out">{c.audience.excludeTags.join(", ")}</Row>}
            <Row icon={<Clock3 />} label="Gap">{c.minDelay}–{c.maxDelay} seconds</Row>
            {c.ai?.personalize && <Row icon={<Sparkles />} label="Writing">AI writes each client their own message</Row>}
            {c.scheduledAt && <Row icon={<CalendarClock />} label="Scheduled">{dateTime(c.scheduledAt)}</Row>}
          </Card>
          <p className="px-1 text-[12px] leading-relaxed text-ink-3">Each client sees their own name and details.</p>
        </aside>
      </div>
    </>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
        <span className={clsx("size-2 rounded-full", color)} />
        {label}
        <span className="ml-auto text-ink-3 [&>svg]:size-3.5">{icon}</span>
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{num(value)}</div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-ink-3 [&>svg]:size-4">{icon}</span>
      <span className="w-20 shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 flex-1 text-ink">{children}</span>
    </div>
  );
}

function RecipientBadge({ r }: { r: Recipient }) {
  if (r.status === "sent") return <Badge tone="brand"><CheckCircle2 className="size-3" />Sent</Badge>;
  if (r.status === "failed") return <Badge tone="danger"><XCircle className="size-3" />Failed</Badge>;
  if (r.status === "skipped") return <Badge tone="neutral">Skipped</Badge>;
  return <Badge tone="info"><Clock3 className="size-3" />Waiting</Badge>;
}
