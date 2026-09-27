import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import clsx from "clsx";
import {
  BookOpen, CalendarDays, Copy, CreditCard, Download, ExternalLink, Flame, Globe, Camera, Link2, MessageCircle, MoreHorizontal,
  Pause, Pencil, Play, Plus, Printer, QrCode, Radar, Snowflake, Sparkles, Sun, Trash2, Users, Clock,
} from "lucide-react";
import { api, del, post, put, type LeadBoard, type LeadLevel, type LeadLink, type LeadRow, type LeadSource } from "../lib/api";
import { useMeta, useNow, useSettings, useStatus } from "../lib/hooks";
import { ago, flag, num, phone as fmtPhone } from "../lib/format";
import { Avatar, Button, Callout, Card, Empty, Label, Loading, Menu, MenuItem, Modal, PageHeader, Segmented, Switch, useConfirm } from "../components/ui";
import { INTENT_LABEL, LEAD_LEVELS, LeadBadge, WaitingChip } from "../components/LeadBits";
import { TagInput } from "../components/TagInput";

type Tab = "radar" | "links";

export function LeadsPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "links" ? "links" : "radar";
  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Who is ready to buy, who is waiting for you — and QR codes that turn every show and post into clients."
      />
      <Segmented<Tab>
        className="mb-6"
        value={tab}
        onChange={(v) => setParams(v === "radar" ? {} : { tab: v }, { replace: true })}
        options={[
          { value: "radar", label: <span className="inline-flex items-center gap-1.5"><Radar className="size-4" /> Lead Radar</span> },
          { value: "links", label: <span className="inline-flex items-center gap-1.5"><QrCode className="size-4" /> Links &amp; QR codes</span> },
        ]}
      />
      {tab === "radar" ? <RadarTab /> : <LinksTab />}
    </>
  );
}

/* ══════ Lead Radar ═════════════════════════════════════════════════════ */

type View = "waiting" | "hot" | "warm" | "all";

function RadarTab() {
  const qc = useQueryClient();
  const now = useNow(30000);
  const { data: settings } = useSettings();
  const { data, isLoading } = useQuery({ queryKey: ["leads"], queryFn: () => api<LeadBoard>("/leads"), refetchInterval: 10000 });
  const [view, setView] = useState<View>("waiting");

  const setLevel = useMutation({
    mutationFn: ({ key, level }: { key: string; level: LeadLevel }) => put(`/conversations/${key}/lead`, { level }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(v.level === "cold" || v.level === "none" ? "Moved off the radar" : `Marked ${LEAD_LEVELS[v.level].label.toLowerCase()}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <Loading />;
  const rows = data.items.filter((r) => (view === "waiting" ? r.waiting : view === "all" ? true : r.lead.level === view));
  const late = data.items.filter((r) => r.waiting && r.waitingSince && now - r.waitingSince >= data.alertHours * 3600000).length;

  return (
    <>
      {settings && !settings.leadRadar.enabled && (
        <Callout tone="warn" className="mb-5" title="Lead Radar is switched off">
          New messages are not being sorted. <Link to="/settings#leads" className="font-semibold underline">Turn it on in Settings</Link>.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile label="Hot & waiting" value={data.counts.hotWaiting} sub={late ? `${late} waiting over ${data.alertHours}h` : "Answer these first"} tone="from-orange-500 to-rose-500" icon={<Flame />} alert={data.counts.hotWaiting > 0} />
        <Tile label="Waiting for you" value={data.counts.waiting} sub="Their message is the last one" tone="from-violet-500 to-indigo-500" icon={<Clock />} />
        <Tile label="Hot leads" value={data.counts.hot} sub="Price, stock, catalogue, orders" tone="from-pink-500 to-rose-500" icon={<Sparkles />} />
        <Tile label="Warm leads" value={data.counts.warm} sub="Engaged, not asking yet" tone="from-amber-400 to-orange-500" icon={<Sun />} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented<View>
          value={view}
          onChange={setView}
          options={[
            { value: "waiting", label: "Waiting", count: data.counts.waiting },
            { value: "hot", label: "Hot", count: data.counts.hot },
            { value: "warm", label: "Warm", count: data.counts.warm },
            { value: "all", label: "All" },
          ]}
        />
        <p className="text-[12px] text-ink-3">Red after {data.alertHours}h without an answer · <Link to="/settings#leads" className="text-brand-text hover:underline">change</Link></p>
      </div>

      <Card className="mt-4 overflow-hidden">
        {rows.length === 0 ? (
          <Empty icon={<Radar className="size-6" />} title={view === "waiting" ? "Nobody is waiting — well done" : "No leads here yet"}>
            Every message a client sends is read and sorted: asking for a price, stock, the catalogue or a meeting is <b>hot</b>; a general question is <b>warm</b>. They appear here the moment they write.
          </Empty>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => <LeadItem key={r.key} r={r} alertHours={data.alertHours} now={now} onLevel={(level) => setLevel.mutate({ key: r.key, level })} />)}
          </ul>
        )}
      </Card>

      <p className="mt-4 flex items-start gap-2 text-[12px] text-ink-3">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" />
        Sorting is instant. With the AI writer on, the AI also reads the conversation and writes what the buyer wants in one line — marked “AI”.
      </p>
    </>
  );
}

function LeadItem({ r, alertHours, now, onLevel }: { r: LeadRow; alertHours: number; now: number; onLevel: (l: LeadLevel) => void }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Avatar name={r.name} seed={r.key} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold text-ink">{r.name || fmtPhone(r.key)}</span>
            <LeadBadge level={r.lead.level} />
            {r.waiting && r.waitingSince && <WaitingChip since={r.waitingSince} alertHours={alertHours} now={now} />}
            {r.lead.by === "ai" && <span className="rounded bg-brand-soft px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-brand-text">AI</span>}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-ink-3">
            {flag(r.country)} {[r.company, fmtPhone(r.key)].filter(Boolean).join(" · ")}
          </div>
          <div className="mt-2 text-[13px] text-ink">
            <b className="font-semibold">{INTENT_LABEL[r.lead.intent] ?? "Wrote to you"}</b>
            {r.lead.summary && <span className="text-ink-2"> — {r.lead.summary}</span>}
          </div>
          {r.lastText && r.lastText !== r.lead.summary && (
            <p className="mt-1 line-clamp-1 text-[12px] italic text-ink-3">“{r.lastText}” · {ago(r.lastAt)}</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
        <Link to={`/inbox/${r.key}`}>
          <Button size="sm" variant={r.waiting ? "primary" : "secondary"} icon={<MessageCircle className="size-4" />}>
            {r.waiting ? "Reply" : "Open chat"}
          </Button>
        </Link>
        <Menu trigger={() => <Button size="sm" aria-label="Change lead"><MoreHorizontal className="size-4" /></Button>}>
          {(close) => (
            <>
              {r.lead.level !== "hot" && <MenuItem icon={<Flame />} onClick={() => { close(); onLevel("hot"); }}>Mark hot</MenuItem>}
              {r.lead.level !== "warm" && <MenuItem icon={<Sun />} onClick={() => { close(); onLevel("warm"); }}>Mark warm</MenuItem>}
              <MenuItem icon={<Snowflake />} onClick={() => { close(); onLevel("cold"); }}>Done / not a lead</MenuItem>
            </>
          )}
        </Menu>
      </div>
    </li>
  );
}

function Tile({ label, value, sub, tone, icon, alert }: { label: string; value: number; sub: string; tone: string; icon: React.ReactNode; alert?: boolean }) {
  return (
    <Card className={clsx("relative overflow-hidden p-4 sm:p-5", alert && "ring-2 ring-rose-400/50")}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-ink-2">{label}</span>
        <span className={clsx("flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg [&>svg]:size-[18px]", tone)}>{icon}</span>
      </div>
      <div className="mt-3 font-display text-[30px] font-extrabold leading-none tracking-tight">{num(value)}</div>
      <div className="mt-2 truncate text-[12px] text-ink-3">{sub}</div>
    </Card>
  );
}

/* ══════ Lead links & QR codes ══════════════════════════════════════════ */

type LinksResp = { items: LeadLink[]; phone: string | null; phoneDisplay: string | null; sources: LeadSource[] };

export const SOURCE_META: Record<LeadSource, { label: string; icon: typeof Globe; tile: string }> = {
  event: { label: "Trade show / event", icon: CalendarDays, tile: "from-violet-500 to-indigo-500" },
  card: { label: "Business card", icon: CreditCard, tile: "from-sky-500 to-blue-600" },
  website: { label: "Website", icon: Globe, tile: "from-emerald-500 to-teal-500" },
  instagram: { label: "Instagram / social", icon: Camera, tile: "from-pink-500 to-orange-400" },
  catalogue: { label: "Catalogue / PDF", icon: BookOpen, tile: "from-amber-400 to-orange-500" },
  other: { label: "Other", icon: Link2, tile: "from-slate-400 to-slate-600" },
};

function LinksTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ["lead-links"], queryFn: () => api<LinksResp>("/lead-links") });
  const [editing, setEditing] = useState<LeadLink | "new" | null>(null);
  const [qrFor, setQrFor] = useState<LeadLink | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if ((location.state as { create?: boolean } | null)?.create) {
      setEditing("new");
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useMutation({
    mutationFn: (l: LeadLink) => put(`/lead-links/${l.id}`, { active: !l.active }),
    onSuccess: (_d, l) => {
      qc.invalidateQueries({ queryKey: ["lead-links"] });
      toast.success(l.active ? "Link paused — messages from it are treated like any other" : "Link active again");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (l: LeadLink) => del(`/lead-links/${l.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-links"] });
      toast.success("Link deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <Loading />;
  const totalLeads = data.items.reduce((a, l) => a + l.leads, 0);

  return (
    <>
      <Card className="relative mb-6 overflow-hidden p-5 sm:p-6">
        <div aria-hidden className="absolute -right-16 -top-20 size-64 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(var(--brand), transparent 70%)" }} />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h2 className="font-display text-lg font-bold">Turn every show, card and post into a client</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">
              Print a QR code at your booth or put a link on your website. A buyer scans it, presses send — and is saved as a client, tagged, added to a batch and welcomed automatically. You see exactly which show or post brought each lead.
            </p>
          </div>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>New link</Button>
        </div>
        {data.items.length > 0 && (
          <div className="relative mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-2">
            <span><b className="text-ink">{num(data.items.length)}</b> links</span>
            <span><b className="text-ink">{num(totalLeads)}</b> leads brought in</span>
            {data.phoneDisplay && <span>Opens a chat with <b className="text-ink">{data.phoneDisplay}</b></span>}
          </div>
        )}
      </Card>

      {!data.phone && (
        <Callout tone="warn" className="mb-5" title="Connect WhatsApp once">
          Links and QR codes point to your WhatsApp number, which we learn when you connect. <Link to="/whatsapp" className="font-semibold underline">Connect now</Link>.
        </Callout>
      )}

      {data.items.length === 0 ? (
        <Card>
          <Empty icon={<QrCode className="size-6" />} title="No lead links yet" action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Create your first link</Button>}>
            Make one for your next trade show — “Hong Kong Fair, Sept 2026” — and one for your website’s WhatsApp button.
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.items.map((l) => {
            const meta = SOURCE_META[l.source] ?? SOURCE_META.other;
            const Icon = meta.icon;
            return (
              <Card key={l.id} className={clsx("flex flex-col p-5", !l.active && "opacity-70")}>
                <div className="flex items-start gap-3">
                  <span className={clsx("flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg", meta.tile)}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-ink">{l.name}</h3>
                      {!l.active && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-3">Paused</span>}
                    </div>
                    <p className="text-[12px] text-ink-3">{meta.label} · ref <span className="font-mono font-semibold text-ink-2">{l.code}</span></p>
                  </div>
                  <Menu trigger={() => <Button size="sm" variant="ghost" aria-label="More"><MoreHorizontal className="size-4" /></Button>}>
                    {(close) => (
                      <>
                        <MenuItem icon={<Pencil />} onClick={() => { close(); setEditing(l); }}>Edit</MenuItem>
                        <MenuItem icon={l.active ? <Pause /> : <Play />} onClick={() => { close(); toggle.mutate(l); }}>{l.active ? "Pause" : "Resume"}</MenuItem>
                        {l.url && <MenuItem icon={<ExternalLink />} onClick={() => { close(); window.open(l.url!, "_blank", "noopener"); }}>Test the link</MenuItem>}
                        <MenuItem icon={<Trash2 />} danger onClick={async () => {
                          close();
                          if (await confirm({ title: `Delete “${l.name}”?`, body: "Printed QR codes will still open WhatsApp, but new messages will no longer be tagged, batched or welcomed. Clients it brought in stay.", confirm: "Delete link", danger: true })) remove.mutate(l);
                        }}>Delete</MenuItem>
                      </>
                    )}
                  </Menu>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                    <div className="text-[12px] text-ink-3">Leads</div>
                    <div className="font-display text-xl font-extrabold">{num(l.leads)}</div>
                  </div>
                  <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                    <div className="text-[12px] text-ink-3">Last lead</div>
                    <div className="truncate text-sm font-semibold">{l.lastLeadAt ? ago(l.lastLeadAt) : "—"}</div>
                  </div>
                </div>

                <ul className="mt-4 space-y-1.5 text-[12px] text-ink-2">
                  <li className="flex items-center gap-2"><Users className="size-3.5 shrink-0 text-ink-3" />
                    {l.batchName ? <>Added to batch <Link to={`/batches/${l.batchId}`} className="truncate font-semibold text-brand-text hover:underline">{l.batchName}</Link></> : l.batchMissing ? <span className="text-warn">Its batch was deleted — pick another</span> : "Not added to a batch"}
                  </li>
                  <li className="flex items-center gap-2"><Sparkles className="size-3.5 shrink-0 text-ink-3" />
                    <span className="truncate">{l.tags.length ? `Tagged ${l.tags.join(", ")}` : "No extra tags"}</span>
                  </li>
                  <li className="flex items-center gap-2"><MessageCircle className="size-3.5 shrink-0 text-ink-3" />
                    <span className="truncate">{l.welcome.trim() ? "Sends its own welcome reply" : "No welcome reply"}</span>
                  </li>
                </ul>

                <div className="mt-auto flex gap-2 pt-5">
                  <Button className="flex-1" variant="primary" icon={<QrCode className="size-4" />} disabled={!l.url} onClick={() => setQrFor(l)}>QR code</Button>
                  <Button className="flex-1" icon={<Copy className="size-4" />} disabled={!l.url} onClick={() => copy(l.url!, "Link copied — paste it on your website or Instagram bio")}>Copy link</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <LinkFormModal open={editing !== null} link={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      <QrModal link={qrFor} onClose={() => setQrFor(null)} />
    </>
  );
}

function copy(text: string, msg: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success(msg), () => toast.error("Could not copy — select and copy it by hand"));
}

const EMPTY = { name: "", code: "", source: "event" as LeadSource, prefill: "", tags: [] as string[], batchId: "", welcome: "", active: true };

function LinkFormModal({ open, link, onClose }: { open: boolean; link: LeadLink | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: meta } = useMeta();
  const { data: status } = useStatus();
  const [f, setF] = useState(EMPTY);
  const [codeTouched, setCodeTouched] = useState(false);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setCodeTouched(Boolean(link));
    setF(link ? { name: link.name, code: link.code, source: link.source, prefill: link.prefill, tags: link.tags, batchId: link.batchId ?? "", welcome: link.welcome, active: link.active } : {
      ...EMPTY,
      prefill: `Hello${status?.businessName ? ` ${status.businessName}` : ""}, I would like to see your latest collection and B2B prices.`,
      welcome: "Dear {{first_name|Sir/Madam}},\n\nThank you for reaching out 💎 Our team will share our latest collection and B2B prices with you shortly.\n\n— {{business_name}}",
    });
  }, [open, link, status?.businessName]);

  // Suggest a reference code from the name until the person types their own.
  const name = f.name;
  useEffect(() => {
    if (!open || codeTouched || !name.trim()) return;
    const t = setTimeout(() => {
      api<{ code: string }>(`/lead-links/suggest-code?name=${encodeURIComponent(name)}`).then((r) => setF((p) => ({ ...p, code: r.code }))).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [name, codeTouched, open]);

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, batchId: f.batchId || null };
      return link ? put<LeadLink>(`/lead-links/${link.id}`, body) : post<LeadLink>("/lead-links", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-links"] });
      toast.success(link ? "Link saved" : "Link created — open its QR code to print or share");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const preview = `${f.prefill.trim()} (Ref: ${f.code || "CODE"})`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={<span className="inline-flex items-center gap-2"><QrCode className="size-4 text-brand" />{link ? "Edit lead link" : "New lead link"}</span>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={!f.name.trim() || f.code.length < 4} onClick={() => save.mutate()}>{link ? "Save" : "Create link"}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <div>
            <Label htmlFor="ll-name">Name</Label>
            <input id="ll-name" className="field" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Hong Kong Fair — Sept 2026" autoFocus />
          </div>
          <div>
            <Label htmlFor="ll-code" hint="Shown in the message">Reference</Label>
            <input id="ll-code" className="field font-mono uppercase" value={f.code} maxLength={16} onChange={(e) => { setCodeTouched(true); set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); }} placeholder="HKF2026" />
          </div>
        </div>

        <div>
          <Label>Where will people see it?</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(SOURCE_META) as LeadSource[]).map((s) => {
              const m = SOURCE_META[s];
              const Icon = m.icon;
              return (
                <button key={s} type="button" onClick={() => set("source", s)} className={clsx("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition-colors", f.source === s ? "border-brand bg-brand-soft text-brand-text" : "border-line hover:bg-surface-2")}>
                  <Icon className="size-4 shrink-0" /> <span className="truncate">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label htmlFor="ll-prefill" hint="Typed in for the buyer — they just press send">Message they send you</Label>
          <textarea id="ll-prefill" rows={2} className="field resize-y" value={f.prefill} maxLength={300} onChange={(e) => set("prefill", e.target.value)} />
          <p className="mt-1.5 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-ink-2"><b className="text-ink-3">They will send:</b> {preview}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label hint="Added to everyone who comes in">Tags</Label>
            <TagInput value={f.tags} onChange={(v) => set("tags", v)} suggestions={meta?.tags.map((t) => t.tag) ?? []} />
          </div>
          <div>
            <Label htmlFor="ll-batch" hint="Ready for your follow-up broadcast">Add to batch</Label>
            <select id="ll-batch" className="field" value={f.batchId} onChange={(e) => set("batchId", e.target.value)}>
              <option value="">— No batch —</option>
              {(meta?.batches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name} ({num(b.members)})</option>)}
            </select>
            {!meta?.batches?.length && <p className="mt-1 text-[12px] text-ink-3">Make batches on the <Link to="/batches" className="text-brand-text hover:underline">Batches</Link> page.</p>}
          </div>
        </div>

        <div>
          <Label htmlFor="ll-welcome" hint="Sent automatically, once per person · leave empty for none">Welcome reply</Label>
          <textarea id="ll-welcome" rows={5} className="field resize-y" value={f.welcome} maxLength={2000} onChange={(e) => set("welcome", e.target.value)} />
          <p className="mt-1 text-[12px] text-ink-3">Use {"{{first_name|Sir/Madam}}"} and {"{{business_name}}"}. It replaces the general auto-reply for people from this link.</p>
        </div>

        <div className="rounded-xl border border-line p-3.5">
          <Switch checked={f.active} onChange={(v) => set("active", v)} label="Active" description="Paused links still open WhatsApp, but messages are not tagged, batched or welcomed." />
        </div>
      </div>
    </Modal>
  );
}

function QrModal({ link, onClose }: { link: LeadLink | null; onClose: () => void }) {
  const { data: status } = useStatus();
  const { data, isLoading, error } = useQuery({
    queryKey: ["lead-qr", link?.id, link?.url],
    queryFn: () => api<{ url: string; png: string; svg: string }>(`/lead-links/${link!.id}/qr`),
    enabled: Boolean(link),
  });
  const file = useMemo(() => (link?.name ?? "lead").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase(), [link?.name]);

  const download = (href: string, name: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
  };

  const printPoster = () => {
    if (!data || !link) return;
    const w = window.open("", "_blank");
    if (!w) return toast.error("Allow pop-ups to print the poster");
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(link.name)}</title>
<style>@page{size:A5;margin:0}body{margin:0;font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;color:#1b1446}
.p{box-sizing:border-box;width:148mm;height:210mm;padding:16mm 14mm;display:flex;flex-direction:column;align-items:center;text-align:center;background:linear-gradient(160deg,#f5f1ff,#fff 45%,#eef4ff)}
.b{font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#6d4aff;font-weight:700}
h1{font-size:30px;line-height:1.15;margin:10mm 0 3mm}p{font-size:15px;color:#4b4668;margin:0}
.q{margin:9mm 0 6mm;padding:5mm;background:#fff;border-radius:6mm;box-shadow:0 6px 30px rgba(109,74,255,.18)}.q img{width:92mm;height:92mm;display:block}
.w{display:inline-flex;align-items:center;gap:8px;background:#25d366;color:#fff;font-weight:700;border-radius:999px;padding:8px 18px;font-size:15px}
.f{margin-top:auto;font-size:11px;color:#8a86a3}</style></head><body><div class="p">
<div class="b">${esc(status?.businessName || "")}</div>
<h1>Scan to get our latest collection</h1><p>Certified diamond jewellery · B2B prices on WhatsApp</p>
<div class="q"><img src="${data.png}" alt="QR code"></div><span class="w">Scan · Press send · Done</span>
<div class="f">Ref ${esc(link.code)}</div></div><script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <Modal open={Boolean(link)} onClose={onClose} title={<span className="inline-flex items-center gap-2"><QrCode className="size-4 text-brand" />{link?.name}</span>}>
      {isLoading ? <Loading label="Making the QR code…" /> : error ? (
        <Callout tone="danger" title="Could not make the QR code">{(error as Error).message}</Callout>
      ) : data && link ? (
        <div className="flex flex-col items-center">
          <div className="rounded-2xl bg-white p-3 shadow-pop ring-1 ring-line">
            <img src={data.png} alt={`QR code for ${link.name}`} className="size-56 sm:size-64" />
          </div>
          <p className="mt-4 max-w-sm text-center text-[13px] text-ink-2">Scanning opens WhatsApp with “{link.text}” typed in. Test it with your own phone before printing.</p>
          <div className="mt-3 flex w-full items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-2">{data.url}</span>
            <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" />} onClick={() => copy(data.url, "Link copied")}>Copy</Button>
          </div>
          <div className="mt-4 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="primary" icon={<Printer className="size-4" />} onClick={printPoster}>Print poster</Button>
            <Button icon={<Download className="size-4" />} onClick={() => download(data.png, `${file}-qr.png`)}>PNG</Button>
            <Button icon={<Download className="size-4" />} onClick={() => download(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.svg)}`, `${file}-qr.svg`)}>SVG (print shop)</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
