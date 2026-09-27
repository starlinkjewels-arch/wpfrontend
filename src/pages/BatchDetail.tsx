import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import {
  ArrowLeft, Layers, Send, Pencil, MoreHorizontal, Trash2, Download, UserPlus, Users, Megaphone, CheckCheck, Eye,
  MessageCircleReply, XCircle, Search, Paperclip, Sparkles, ChevronDown, CalendarClock, BellOff, X, UserMinus,
} from "lucide-react";
import { api, del, post, type BatchDetail, type BatchHistoryItem, type Contact } from "../lib/api";
import { useDebounced } from "../lib/hooks";
import { batchColor } from "../lib/batchColors";
import { ago, dateTime, flag, num, pct, phone } from "../lib/format";
import { exportRows } from "../lib/excel";
import { Avatar, Badge, Button, Card, Checkbox, Empty, Loading, Menu, MenuItem, Modal, Segmented, Tag, useConfirm } from "../components/ui";
import { StatusBadge } from "../components/CampaignBits";
import { WaText } from "../components/PhonePreview";
import { BatchFormModal } from "../components/BatchModals";

type Tab = "history" | "members";

export function BatchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("history");
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  const { data: b, isLoading, error } = useQuery({
    queryKey: ["batch", id],
    queryFn: () => api<BatchDetail>(`/batches/${id}`),
    refetchInterval: (q) => (q.state.data?.history.some((h) => ["running", "queued"].includes(h.status)) ? 4000 : false),
  });

  const remove = useMutation({
    mutationFn: () => del(`/batches/${id}`),
    onSuccess: () => {
      toast.success("Batch deleted — its broadcasts are kept");
      qc.invalidateQueries({ queryKey: ["batches"] });
      navigate("/batches");
    },
  });

  if (isLoading) return <Loading />;
  if (error || !b) return <p className="py-20 text-center text-ink-3">Batch not found. <Link className="text-brand-text underline" to="/batches">All batches</Link></p>;

  const col = batchColor(b.color);
  const t = b.totals;
  const exportMembers = () =>
    exportRows(
      b.members.map((m) => ({
        Name: m.name,
        Company: m.company,
        "WhatsApp Number": "+" + m.phone,
        Country: m.country,
        Tags: m.tags.join(", "),
        Status: m.optedOut ? "Opted out" : m.waStatus === "invalid" ? "Not on WhatsApp" : "Active",
        "Last reply": m.lastInboundAt ? new Date(m.lastInboundAt).toLocaleString() : "",
      })),
      `${b.name.replace(/[^\w -]+/g, "").slice(0, 40) || "batch"}-clients.xlsx`,
      "Clients",
    );

  return (
    <>
      <Link to="/batches" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> Batches
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className={clsx("flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", col.tile)}>
            <Layers className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight sm:text-[30px]">{b.name}</h1>
            <p className="mt-1 text-sm text-ink-3">
              {num(b.members.length)} clients · created {ago(b.createdAt)}
              {b.lastSentAt && <> · last sent {ago(b.lastSentAt)}</>}
            </p>
            {b.description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">{b.description}</p>}
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button className="max-sm:flex-1" icon={<UserPlus className="size-4" />} onClick={() => setAdding(true)}>Add clients</Button>
          <Button variant="primary" className="max-sm:flex-1" icon={<Send className="size-4" />} disabled={!b.members.length} onClick={() => navigate("/campaigns/new", { state: { batchIds: [b.id] } })}>
            Send broadcast
          </Button>
          <Menu trigger={() => <Button aria-label="More"><MoreHorizontal className="size-4" /></Button>}>
            {(close) => (
              <>
                <MenuItem icon={<Pencil />} onClick={() => { close(); setEditing(true); }}>Edit name & colour</MenuItem>
                <MenuItem icon={<Download />} onClick={() => { close(); exportMembers(); }}>Export clients to Excel</MenuItem>
                <MenuItem icon={<Users />} onClick={() => { close(); navigate(`/clients?batch=${b.id}`); }}>Open in Clients</MenuItem>
                <MenuItem icon={<Trash2 />} danger onClick={async () => {
                  close();
                  if (await confirm({ title: `Delete “${b.name}”?`, body: "The batch is removed. Its clients stay in your client list, and past broadcasts keep their results.", confirm: "Delete batch", danger: true })) remove.mutate();
                }}>Delete batch</MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>

      {/* Totals across every broadcast this batch received */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Clients" value={num(b.members.length)} icon={<Users />} tone="from-violet-500 to-indigo-500" />
        <Tile label="Broadcasts" value={num(t.broadcasts)} icon={<Megaphone />} tone="from-sky-500 to-blue-600" />
        <Tile label="Messages sent" value={num(t.sent)} icon={<Send />} tone="from-cyan-400 to-sky-500" />
        <Tile label="Delivered" value={t.sent ? `${pct(t.delivered, t.sent)}%` : "—"} icon={<CheckCheck />} tone="from-emerald-400 to-teal-500" />
        <Tile label="Read" value={t.sent ? `${pct(t.read, t.sent)}%` : "—"} icon={<Eye />} tone="from-amber-400 to-orange-500" />
        <Tile label="Replied" value={t.sent ? `${pct(t.replied, t.sent)}%` : "—"} icon={<MessageCircleReply />} tone="from-pink-500 to-rose-500" />
      </div>

      <Segmented
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: "history", label: "History", count: b.history.length },
          { value: "members", label: "Clients", count: b.members.length },
        ]}
      />

      {tab === "history" ? <History b={b} /> : <Members b={b} />}

      <BatchFormModal open={editing} onClose={() => setEditing(false)} batch={b} />
      <AddClientsModal open={adding} onClose={() => setAdding(false)} batch={b} />
    </>
  );
}

function Tile({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12px] font-semibold text-ink-2">{label}</span>
        <span className={clsx("flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white [&>svg]:size-3.5", tone)}>{icon}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-extrabold tracking-tight">{value}</div>
    </Card>
  );
}

/** Every broadcast this batch received, newest first, with what it said and how it did. */
function History({ b }: { b: BatchDetail }) {
  const navigate = useNavigate();
  if (!b.history.length) {
    return (
      <Card>
        <Empty icon={<Megaphone className="size-6" />} title="Nothing sent to this batch yet" action={b.members.length ? <Button variant="primary" icon={<Send className="size-4" />} onClick={() => navigate("/campaigns/new", { state: { batchIds: [b.id] } })}>Send the first broadcast</Button> : undefined}>
          Every broadcast you send to this batch will be listed here — the message, when it went, and who received, read and replied.
        </Empty>
      </Card>
    );
  }
  return (
    <ol className="relative space-y-4 border-l-2 border-dashed border-line pl-6">
      {b.history.map((h) => <HistoryItem key={h.id} h={h} />)}
    </ol>
  );
}

function HistoryItem({ h }: { h: BatchHistoryItem }) {
  const [open, setOpen] = useState(false);
  const s = h.stats;
  const when = h.startedAt ?? h.scheduledAt ?? h.createdAt;
  const link = h.status === "draft" ? `/campaigns/${h.id}/edit` : `/campaigns/${h.id}`;
  return (
    <li className="relative">
      <span className="bg-brand-gradient glow-brand absolute -left-[33px] top-5 size-4 rounded-full ring-4 ring-bg" />
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={link} className="font-display text-[16px] font-extrabold tracking-tight text-ink hover:underline">{h.name}</Link>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
              <span className="flex items-center gap-1"><CalendarClock className="size-3.5" />{h.status === "scheduled" ? "Scheduled for " : h.startedAt ? "Sent " : "Created "}{dateTime(when)}</span>
              {h.finishedAt && <span>finished {dateTime(h.finishedAt)}</span>}
              {h.batchCount > 1 && <span>· together with {h.batchCount - 1} other batch{h.batchCount > 2 ? "es" : ""}</span>}
              {h.mediaId && <span className="flex items-center gap-1"><Paperclip className="size-3.5" />attachment</span>}
              {h.aiPersonalize && <span className="flex items-center gap-1 text-gold"><Sparkles className="size-3.5" />AI personalised</span>}
            </div>
          </div>
          <StatusBadge status={h.status} />
        </div>

        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-3 block w-full text-left">
          <div className={clsx("whitespace-pre-wrap rounded-xl bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-ink-2", !open && "line-clamp-3")}>
            <WaText text={h.message || "(attachment only)"} />
          </div>
          <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-brand-text">
            <ChevronDown className={clsx("size-3.5 transition-transform", open && "rotate-180")} /> {open ? "Show less" : "Show full message"}
          </span>
        </button>

        {s && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Stat icon={<Send />} label="Sent" value={s.sent} of={s.total} />
            <Stat icon={<CheckCheck />} label="Delivered" value={s.delivered ?? 0} of={s.sent} />
            <Stat icon={<Eye />} label="Read" value={s.read ?? 0} of={s.sent} />
            <Stat icon={<MessageCircleReply />} label="Replied" value={s.replied ?? 0} of={s.sent} strong />
            {s.failed > 0 && <Stat icon={<XCircle />} label="Failed" value={s.failed} of={s.total} bad />}
            {(s.optedOut ?? 0) > 0 && <Stat icon={<BellOff />} label="Opted out" value={s.optedOut ?? 0} of={s.sent} bad />}
            {s.pending > 0 && <Stat icon={<CalendarClock />} label="Waiting" value={s.pending} of={s.total} />}
          </div>
        )}
        <div className="mt-4">
          <Link to={link} className="text-[13px] font-semibold text-brand-text hover:underline">{h.status === "draft" ? "Continue editing →" : "Full report →"}</Link>
        </div>
      </Card>
    </li>
  );
}

function Stat({ icon, label, value, of, strong, bad }: { icon: React.ReactNode; label: string; value: number; of: number; strong?: boolean; bad?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] [&>svg]:size-3.5", bad ? "bg-danger-soft text-danger" : strong ? "bg-brand-soft text-brand-text" : "bg-surface-2 text-ink-2")}>
      {icon}
      <b className="text-[13px]">{num(value)}</b> {label}
      {of > 0 && <span className="opacity-70">· {pct(value, of)}%</span>}
    </span>
  );
}

/** The clients in the batch, with a way to take some out. */
function Members({ b }: { b: BatchDetail }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const dq = useDebounced(q).toLowerCase();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const shown = useMemo(() => b.members.filter((m) => !dq || `${m.name} ${m.company} ${m.phone} ${m.tags.join(" ")}`.toLowerCase().includes(dq)), [b.members, dq]);

  const removeM = useMutation({
    mutationFn: (ids: string[]) => post<{ removed: number }>(`/batches/${b.id}/members/remove`, { ids }),
    onSuccess: (r) => {
      toast.success(`${num(r.removed)} removed from the batch`);
      setSel(new Set());
      qc.invalidateQueries({ queryKey: ["batch", b.id] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });

  if (!b.members.length) {
    return (
      <Card>
        <Empty icon={<Users className="size-6" />} title="No clients in this batch">
          Add clients from the Clients page (select → Add to batch), or with “Add clients” above.
        </Empty>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input className="field h-9 pl-9" placeholder="Search clients in this batch" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {sel.size > 0 && (
          <Button size="sm" variant="ghost" className="!text-danger hover:!bg-danger-soft" icon={<UserMinus className="size-4" />} loading={removeM.isPending}
            onClick={async () => { if (await confirm({ title: `Remove ${num(sel.size)} from “${b.name}”?`, body: "They stay in your client list — only this batch changes.", confirm: "Remove", danger: true })) removeM.mutate([...sel]); }}>
            Remove {num(sel.size)}
          </Button>
        )}
      </div>
      <ul className="divide-y divide-line">
        <li className="flex items-center gap-3 bg-surface-2/60 px-4 py-2 text-[12px] font-medium text-ink-3">
          <Checkbox label="Select all shown" checked={shown.length > 0 && shown.every((m) => sel.has(m.id))} onChange={(v) => setSel(v ? new Set(shown.map((m) => m.id)) : new Set())} />
          {num(shown.length)} client{shown.length === 1 ? "" : "s"}
        </li>
        {shown.map((m) => (
          <li key={m.id} className={clsx("flex items-center gap-3 px-4 py-3", sel.has(m.id) && "bg-brand-soft/40")}>
            <Checkbox label={`Select ${m.name}`} checked={sel.has(m.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} />
            <Avatar name={m.name} seed={m.id} size={36} />
            <Link to={`/inbox/${m.id}`} className="min-w-0 flex-1 hover:underline">
              <div className="truncate text-sm font-semibold">{m.name || phone(m.phone)}</div>
              <div className="truncate text-[12px] text-ink-3">{flag(m.country)} {phone(m.phone)}{m.company && ` · ${m.company}`}</div>
            </Link>
            <div className="hidden max-w-[220px] flex-wrap gap-1 lg:flex">{m.tags.slice(0, 2).map((tg) => <Tag key={tg}>{tg}</Tag>)}</div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {m.optedOut ? <Badge tone="warn">Opted out</Badge> : m.waStatus === "invalid" ? <Badge tone="danger">Not on WhatsApp</Badge> : m.lastInboundAt ? <Badge tone="brand"><MessageCircleReply className="size-3" />Replied {ago(m.lastInboundAt)}</Badge> : <Badge tone="neutral">No reply yet</Badge>}
              {m.lastCampaignAt && <span className="text-[11px] text-ink-3">Last broadcast {ago(m.lastCampaignAt)}</span>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Pick more clients to add, right from the batch. */
function AddClientsModal({ open, onClose, batch }: { open: boolean; onClose: () => void; batch: BatchDetail }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const inBatch = useMemo(() => new Set(batch.members.map((m) => m.id)), [batch.members]);
  const { data } = useQuery({
    queryKey: ["batch-picker", dq],
    queryFn: () => api<{ items: Contact[]; total: number }>(`/contacts?q=${encodeURIComponent(dq)}&pageSize=200&sort=name`),
    enabled: open,
  });
  const items = (data?.items ?? []).filter((c) => !inBatch.has(c.id));
  const add = useMutation({
    mutationFn: () => post<{ added: number }>(`/batches/${batch.id}/members`, { ids: [...sel] }),
    onSuccess: (r) => {
      toast.success(`${num(r.added)} clients added`);
      setSel(new Set());
      qc.invalidateQueries({ queryKey: ["batch", batch.id] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      onClose();
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add clients to “${batch.name}”`}
      footer={<><span className="mr-auto self-center text-[13px] text-ink-3">{num(sel.size)} selected</span><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!sel.size} loading={add.isPending} onClick={() => add.mutate()}>Add {num(sel.size)}</Button></>}
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <input autoFocus className="field pl-9" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3" onClick={() => setQ("")} aria-label="Clear"><X className="size-4" /></button>}
      </div>
      <div className="mb-2 flex gap-3 text-[12px] font-medium">
        <button className="text-brand-text hover:underline" onClick={() => setSel(new Set([...sel, ...items.map((c) => c.id)]))}>Select all shown</button>
        <button className="text-ink-3 hover:underline" onClick={() => setSel(new Set())}>Clear</button>
      </div>
      <ul className="-mx-2 max-h-[50vh] overflow-y-auto">
        {items.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
              <Checkbox label={c.name} checked={sel.has(c.id)} onChange={(v) => setSel((s) => { const n = new Set(s); if (v) n.add(c.id); else n.delete(c.id); return n; })} />
              <Avatar name={c.name} seed={c.id} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name || phone(c.phone)}</span>
                <span className="block truncate text-[12px] text-ink-3">{c.company || phone(c.phone)}</span>
              </span>
            </label>
          </li>
        ))}
        {!items.length && <li className="px-2 py-6 text-center text-[13px] text-ink-3">Everyone matching is already in this batch.</li>}
      </ul>
    </Modal>
  );
}
