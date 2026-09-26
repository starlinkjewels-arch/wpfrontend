import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Loader2, Pencil, RotateCcw, Search, Sparkles, Square, Undo2, UserRound } from "lucide-react";
import { api, del, post, put, type AiDraftRow, type AiDrafts, type Campaign } from "../lib/api";
import { useDebounced } from "../lib/hooks";
import { Avatar, Badge, Button, Card, Empty, Loading, Progress, Segmented, useConfirm } from "../components/ui";
import { WaText } from "../components/PhonePreview";
import { AiSetupHint } from "../components/AiTools";
import { StatusBadge } from "../components/CampaignBits";
import { flag, num, phone, pct } from "../lib/format";

type Filter = "all" | "missing" | "outdated" | "edited" | "ready";

const STATE_BADGE: Record<AiDraftRow["state"], { label: string; tone: "brand" | "gold" | "warn" | "neutral" }> = {
  ready: { label: "Written by AI", tone: "brand" },
  edited: { label: "Edited by you", tone: "gold" },
  outdated: { label: "Outdated", tone: "warn" },
  missing: { label: "Not written yet", tone: "neutral" },
};

/**
 * Every client's own AI message for one campaign, for the admin to check.
 * Nothing here is required: a message not written in advance is written just
 * before it is sent. This page is for looking first.
 */
export function CampaignReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);

  const campaign = useQuery({ queryKey: ["campaign", id], queryFn: () => api<Campaign>(`/campaigns/${id}`) });
  const drafts = useQuery({
    queryKey: ["ai-drafts", id, filter, dq, page],
    queryFn: () => api<AiDrafts>(`/campaigns/${id}/ai?filter=${filter}&q=${encodeURIComponent(dq)}&page=${page}`),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.job?.running ? 1500 : false),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["ai-drafts", id] });

  const generate = useMutation({
    mutationFn: (mode: "missing" | "all") => post(`/campaigns/${id}/ai/generate`, { mode }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });
  const stop = useMutation({ mutationFn: () => post(`/campaigns/${id}/ai/cancel`), onSuccess: () => refresh() });

  if (campaign.isLoading || drafts.isLoading) return <Loading />;
  const c = campaign.data;
  const d = drafts.data;
  if (!c || !d) return <p className="py-20 text-center text-ink-3">Campaign not found.</p>;

  const job = d.job;
  const running = Boolean(job?.running);
  const todo = d.counts.missing + d.counts.outdated;
  const finished = ["completed", "cancelled"].includes(c.status);
  const editable = !finished;
  const backTo = ["draft", "scheduled"].includes(c.status) || (c.status === "paused" && !c.materialized) ? `/campaigns/${c.id}/edit` : `/campaigns/${c.id}`;

  return (
    <div className="pb-28">
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> {c.name}
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[28px] font-medium leading-tight tracking-tight sm:text-[32px]">Each client's message</h1>
            <StatusBadge status={c.status} />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">
            The AI writes every client their own version of your message. Check them, edit any you like — your edits are always sent exactly as you wrote them.
          </p>
        </div>
      </div>

      {!c.ai?.personalize && (
        <div className="mb-5 rounded-xl bg-warn-soft px-4 py-3 text-[13px] text-warn">
          AI personalisation is switched off for this campaign, so these messages will not be used. Turn it on in the campaign editor.
        </div>
      )}

      {/* Progress / action card */}
      <Card className="mb-6 p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Count label="Clients" value={d.counts.total} />
          <Count label="Written by AI" value={d.counts.ready} dot="bg-brand" />
          <Count label="Edited by you" value={d.counts.edited} dot="bg-gold" />
          <Count label="To write" value={todo} dot={todo ? "bg-warn" : "bg-surface-3"} />
        </div>
        <div className="mt-5 border-t border-line pt-5">
          {running && job ? (
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium"><Loader2 className="size-4 animate-spin text-gold" /> Writing {num(job.done + job.failed)} of {num(job.total)}…</span>
                <Button size="sm" variant="ghost" icon={<Square className="size-3.5" />} onClick={() => stop.mutate()}>Stop</Button>
              </div>
              <Progress value={pct(job.done + job.failed, job.total)} tone="gold" />
              <p className="mt-2 text-[12px] text-ink-3">You can leave this page — writing continues on the server.</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {todo > 0 && editable && (
                <Button variant="primary" icon={<Sparkles className="size-4" />} loading={generate.isPending} onClick={() => generate.mutate("missing")}>
                  Write {num(todo)} message{todo === 1 ? "" : "s"} with AI
                </Button>
              )}
              {d.counts.ready > 0 && editable && (
                <Button
                  icon={<RotateCcw className="size-4" />}
                  onClick={async () => {
                    if (await confirm({ title: "Rewrite all AI messages?", body: "Every message written by the AI gets a fresh version. Messages you edited are kept as they are.", confirm: "Rewrite" })) generate.mutate("all");
                  }}
                >
                  Rewrite all
                </Button>
              )}
              {todo === 0 && d.counts.total > 0 && (
                <span className="flex items-center gap-2 text-sm font-medium text-brand-text"><Check className="size-4" /> Every client's message is ready</span>
              )}
              {job && !job.running && job.failed > 0 && (
                <span className="text-[13px] text-danger">{num(job.failed)} could not be written: {job.lastError}</span>
              )}
              {todo > 0 && <span className="text-[12px] text-ink-3">Not required — any message not written now is written just before it is sent.</span>}
              <AiSetupHint className="w-full" />
            </div>
          )}
        </div>
      </Card>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="scroll-thin -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <Segmented<Filter>
            value={filter}
            onChange={(v) => { setFilter(v); setPage(1); }}
            options={[
              { value: "all", label: "All", count: d.counts.total },
              { value: "missing", label: "Not written", count: d.counts.missing },
              { value: "outdated", label: "Outdated", count: d.counts.outdated },
              { value: "edited", label: "Edited", count: d.counts.edited },
              { value: "ready", label: "By AI", count: d.counts.ready },
            ]}
          />
        </div>
        <div className="relative lg:ml-auto lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input className="field h-10 pl-9" placeholder="Find a client or a word" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>
      {d.counts.outdated > 0 && filter !== "outdated" && (
        <p className="mb-4 text-[13px] text-warn">{num(d.counts.outdated)} messages were written before you changed the campaign text. They will be rewritten — press “Write with AI” above to do it now.</p>
      )}

      {d.items.length === 0 ? (
        <Card><Empty icon={<UserRound className="size-6" />} title="No clients here">Try another filter.</Empty></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {d.items.map((row) => <DraftCard key={row.phone} campaignId={c.id} row={row} editable={editable && !running} onChanged={refresh} />)}
        </div>
      )}

      {d.total > d.pageSize && (
        <div className="mt-5 flex items-center justify-between text-[13px] text-ink-3">
          <span>Page {page} of {Math.ceil(d.total / d.pageSize)}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="size-4" />}>Prev</Button>
            <Button size="sm" variant="ghost" disabled={page * d.pageSize >= d.total} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="size-4" /></Button>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="fixed inset-x-0 bottom-[68px] z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-[260px]">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 lg:px-6">
          <span className="hidden flex-1 text-[13px] text-ink-3 sm:block">Changes are saved as you make them.</span>
          <Button variant="primary" size="lg" className="ml-auto" onClick={() => navigate(backTo)}>
            {backTo.endsWith("/edit") ? "Continue to send" : "Back to campaign"} <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Count({ label, value, dot }: { label: string; value: number; dot?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
        {dot && <span className={clsx("size-2 rounded-full", dot)} />}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{num(value)}</div>
    </div>
  );
}

function DraftCard({ campaignId, row, editable, onChanged }: { campaignId: string; row: AiDraftRow; editable: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(row.text);
  const badge = STATE_BADGE[row.state];

  const save = useMutation({
    mutationFn: () => put(`/campaigns/${campaignId}/ai/${row.phone}`, { text }),
    onSuccess: () => { setEditing(false); toast.success("Saved — this exact text will be sent"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const regen = useMutation({
    mutationFn: () => post(`/campaigns/${campaignId}/ai/${row.phone}/regenerate`),
    onSuccess: () => onChanged(),
    onError: (e: Error) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: () => del(`/campaigns/${campaignId}/ai/${row.phone}`),
    onSuccess: () => { toast.success("Your edit was removed — the AI will write this one"); onChanged(); },
  });

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center gap-3">
        <Avatar name={row.name} seed={row.phone} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{row.name || phone(row.phone)}</div>
          <div className="truncate text-[12px] text-ink-3">{flag(row.country)} {phone(row.phone)}{row.company && ` · ${row.company}`}</div>
        </div>
        <Badge tone={badge.tone}>{row.state === "ready" && <Sparkles className="size-3" />}{badge.label}</Badge>
      </div>

      <div className="mt-3 flex-1">
        {editing ? (
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} autoFocus className="field resize-y text-[14px] leading-relaxed" />
        ) : row.text ? (
          <div className={clsx("chat-wallpaper rounded-xl p-3", row.state === "outdated" && "opacity-60")}>
            <div className="ml-auto max-w-[95%] whitespace-pre-wrap break-words rounded-lg rounded-tr-none bg-[var(--bubble-out)] px-3 py-2 text-[13.5px] leading-relaxed text-[#111b21] shadow-sm dark:text-[#e9edef]">
              <WaText text={row.text} />
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-24 items-center justify-center rounded-xl border border-dashed border-line-strong px-4 text-center text-[13px] text-ink-3">
            {regen.isPending ? <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Writing…</span> : "Not written yet — the AI will write it before sending, or write it now."}
          </div>
        )}
      </div>

      {editable && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="primary" icon={<Check className="size-4" />} loading={save.isPending} disabled={!text.trim()} onClick={() => save.mutate()}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(row.text); }}>Cancel</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => { setText(row.text); setEditing(true); }}>{row.text ? "Edit" : "Write my own"}</Button>
              <Button size="sm" variant="ghost" icon={<Sparkles className="size-3.5" />} loading={regen.isPending} onClick={() => regen.mutate()}>{row.text ? "Rewrite with AI" : "Write with AI"}</Button>
              {row.state === "edited" && (
                <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} loading={reset.isPending} onClick={() => reset.mutate()}>Undo my edit</Button>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
