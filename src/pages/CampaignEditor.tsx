import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, Check, ChevronDown, Gauge, Rabbit, Send, Shield, Shuffle, Smartphone, Tags, Turtle, Users, UserCheck, Zap, Search, Info, FlaskConical } from "lucide-react";
import { api, post, put, type Audience, type Campaign, type Contact, type Media } from "../lib/api";
import { useDebounced, useMeta, useSettings, useStatus } from "../lib/hooks";
import { Button, Card, Checkbox, Label, Loading, Modal, Segmented, Avatar, useConfirm } from "../components/ui";
import { MessageComposer } from "../components/MessageComposer";
import { PhonePreview } from "../components/PhonePreview";
import { duration, friendlyWhen, num, phone } from "../lib/format";
import { local } from "../lib/storage";

type Speed = "safe" | "normal" | "fast" | "custom";
const SPEEDS: Record<Exclude<Speed, "custom">, { min: number; max: number; label: string; icon: typeof Shield; note: string }> = {
  safe: { min: 20, max: 45, label: "Safe", icon: Turtle, note: "Best for new numbers & big lists" },
  normal: { min: 10, max: 25, label: "Normal", icon: Gauge, note: "Recommended" },
  fast: { min: 5, max: 12, label: "Fast", icon: Rabbit, note: "Small lists of known clients" },
};

type Form = {
  name: string;
  message: string;
  media: Media | null;
  audience: Audience;
  when: "now" | "later";
  sendAt: string; // datetime-local value
  speed: Speed;
  minDelay: number;
  maxDelay: number;
};

type AudiencePreview = {
  count: number;
  excluded: { optedOut: number; invalid: number; excludedTag: number };
  sample: { id: string; name: string; company: string; phone: string }[];
  missing: { key: string; label: string; missing: number }[];
  estimateMs: number;
};

const DRAFT_KEY = "sl.campaign-draft";

const emptyAudience: Audience = { mode: "all", tags: [], tagMatch: "any", contactIds: [], excludeTags: [] };

function toLocalInput(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function speedOf(min: number, max: number): Speed {
  const hit = (Object.keys(SPEEDS) as (keyof typeof SPEEDS)[]).find((k) => SPEEDS[k].min === min && SPEEDS[k].max === max);
  return hit ?? "custom";
}

function quickTimes() {
  const at = (days: number, h: number, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const nextMonday = () => {
    const d = new Date();
    const add = ((8 - d.getDay()) % 7) || 7;
    return at(add, 10);
  };
  const list = [
    { label: "Today 6 PM", ms: at(0, 18) },
    { label: "Tomorrow 10 AM", ms: at(1, 10) },
    { label: "Tomorrow 4 PM", ms: at(1, 16) },
    { label: "Monday 10 AM", ms: nextMonday() },
  ];
  return list.filter((q) => q.ms > Date.now() + 5 * 60000);
}

export function CampaignEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: status } = useStatus();
  const { data: settings } = useSettings();
  const { data: meta } = useMeta();
  const editing = Boolean(id);

  const existing = useQuery({ queryKey: ["campaign", id], queryFn: () => api<Campaign>(`/campaigns/${id}`), enabled: editing });

  const [f, setF] = useState<Form | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [shuffle, setShuffle] = useState(0);
  const [moreAudience, setMoreAudience] = useState(false);
  const loaded = useRef(false);

  // Build the starting form once: an existing campaign, clients handed over
  // from another page, a draft left in this browser, or blank.
  useEffect(() => {
    if (loaded.current || !settings) return;
    if (editing) {
      const c = existing.data;
      if (!c) return;
      if (!["draft", "scheduled"].includes(c.status) && !(c.status === "paused" && !c.materialized)) {
        navigate(`/campaigns/${c.id}`, { replace: true });
        return;
      }
      loaded.current = true;
      setF({
        name: c.name,
        message: c.message,
        media: c.media,
        audience: c.audience,
        when: c.status === "scheduled" && c.scheduledAt && c.scheduledAt > Date.now() + 60000 ? "later" : "now",
        sendAt: toLocalInput(c.scheduledAt && c.scheduledAt > Date.now() ? c.scheduledAt : Date.now() + 3600000),
        speed: speedOf(c.minDelay, c.maxDelay),
        minDelay: c.minDelay,
        maxDelay: c.maxDelay,
      });
      return;
    }
    loaded.current = true;
    const handed = location.state as { contactIds?: string[]; tags?: string[] } | null;
    const base: Form = {
      name: "",
      message: "",
      media: null,
      audience: emptyAudience,
      when: "now",
      sendAt: toLocalInput(Date.now() + 3600000),
      speed: speedOf(settings.minDelay, settings.maxDelay),
      minDelay: settings.minDelay,
      maxDelay: settings.maxDelay,
    };
    if (handed?.contactIds?.length) setF({ ...base, audience: { ...emptyAudience, mode: "contacts", contactIds: handed.contactIds } });
    else if (handed?.tags?.length) setF({ ...base, audience: { ...emptyAudience, mode: "tags", tags: handed.tags } });
    else {
      const draft = local.get<Form | null>(DRAFT_KEY, null);
      if (draft && (draft.message || draft.name)) {
        setF({ ...base, ...draft });
        toast.info("Your unsent campaign was restored", { action: { label: "Start fresh", onClick: () => { local.remove(DRAFT_KEY); setF(base); } } });
      } else setF(base);
    }
  }, [editing, existing.data, settings, location.state, navigate]);

  // A new campaign is kept in this browser as it is written.
  useEffect(() => {
    if (!editing && f) local.set(DRAFT_KEY, f);
  }, [f, editing]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => (prev ? { ...prev, [k]: v } : prev));
  const setAud = (patch: Partial<Audience>) => setF((prev) => (prev ? { ...prev, audience: { ...prev.audience, ...patch } } : prev));

  const dAudience = useDebounced(f?.audience, 300);
  const dMessage = useDebounced(f?.message ?? "", 400);
  const aud = useQuery({
    queryKey: ["audience", dAudience, dMessage],
    queryFn: () => post<AudiencePreview>("/audience/preview", { audience: dAudience, message: dMessage }),
    enabled: Boolean(dAudience),
    placeholderData: (p) => p,
  });

  const previewContact = aud.data?.sample[previewIdx % Math.max(1, aud.data?.sample.length ?? 1)];
  const render = useQuery({
    queryKey: ["render", dMessage, previewContact?.id, shuffle],
    queryFn: () => post<{ text: string; contact: { name: string } }>("/render", { message: dMessage, contactId: previewContact?.id }),
    enabled: Boolean(dMessage.trim()),
    placeholderData: (p) => p,
  });

  const sendAtMs = f ? new Date(f.sendAt).getTime() : 0;
  const count = aud.data?.count ?? 0;
  const estimate = count * (((f?.minDelay ?? 10) + (f?.maxDelay ?? 25)) / 2 + 3) * 1000;

  const body = (action: "draft" | "schedule") => ({
    name: f!.name,
    message: f!.message,
    mediaId: f!.media?.id ?? null,
    audience: f!.audience,
    minDelay: f!.minDelay,
    maxDelay: f!.maxDelay,
    action,
    sendAt: f!.when === "later" ? sendAtMs : undefined,
  });

  const save = useMutation({
    mutationFn: (action: "draft" | "schedule") => (editing ? put<Campaign>(`/campaigns/${id}`, body(action)) : post<Campaign>("/campaigns", body(action))),
    onSuccess: (c, action) => {
      if (!editing) local.remove(DRAFT_KEY);
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (action === "draft") {
        toast.success("Draft saved");
        navigate("/campaigns");
      } else {
        toast.success(f!.when === "later" ? `Scheduled for ${friendlyWhen(c.scheduledAt)}` : "Sending has started");
        navigate(`/campaigns/${c.id}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => post<{ to: string }>("/test-message", { message: f!.message, mediaId: f!.media?.id, contactId: previewContact?.id }),
    onSuccess: (r) => toast.success(`Test sent to your WhatsApp ${phone(r.to)}`),
    onError: (e: Error) => toast.error(e.message),
  });

  const problems = useMemo(() => {
    if (!f) return [];
    const p: string[] = [];
    if (!f.message.trim() && !f.media) p.push("Write a message");
    if (f.audience.mode === "tags" && !f.audience.tags.length) p.push("Choose at least one tag");
    if (f.audience.mode === "contacts" && !f.audience.contactIds.length) p.push("Pick at least one client");
    if (aud.data && !aud.data.count) p.push("No clients to send to");
    if (f.when === "later" && (!sendAtMs || sendAtMs < Date.now() - 60000)) p.push("Pick a future time");
    return p;
  }, [f, aud.data, sendAtMs]);

  async function launch() {
    if (problems.length) return toast.error(problems[0]);
    const ok = await confirm({
      title: f!.when === "later" ? `Schedule for ${friendlyWhen(sendAtMs)}?` : `Send to ${num(count)} clients now?`,
      body: (
        <div className="space-y-1.5">
          <p>Messages go out one by one, {f!.minDelay}–{f!.maxDelay} seconds apart — {duration(estimate)} in total.</p>
          {settings?.window.enabled && <p>Only between {settings.window.start} and {settings.window.end}; it continues the next day if needed.</p>}
          {status?.wa.status !== "connected" && <p className="font-medium text-warn">WhatsApp is not connected — it will start as soon as you connect.</p>}
          <p>You can pause or cancel at any time.</p>
        </div>
      ),
      confirm: f!.when === "later" ? "Schedule" : "Start sending",
    });
    if (ok) save.mutate("schedule");
  }

  if (!f || (editing && existing.isLoading)) return <Loading />;

  const tagList = meta?.tags ?? [];

  return (
    <div className="pb-28">
      <Link to="/campaigns" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> Campaigns
      </Link>
      <input
        value={f.name}
        onChange={(e) => set("name", e.target.value)}
        placeholder="Untitled campaign"
        aria-label="Campaign name"
        className="mb-6 w-full bg-transparent font-display text-[28px] font-medium tracking-tight text-ink outline-none placeholder:text-ink-3 sm:text-[32px]"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-10">
        <div className="min-w-0 space-y-6">
          {/* 1. Audience */}
          <Section n={1} title="Who should get it?">
            <div className="grid gap-2.5 sm:grid-cols-3">
              <Choice active={f.audience.mode === "all"} onClick={() => setAud({ mode: "all" })} icon={<Users />} title="All clients" sub={meta ? `${num(meta.counts.active)} active` : ""} />
              <Choice active={f.audience.mode === "tags"} onClick={() => setAud({ mode: "tags" })} icon={<Tags />} title="By tag" sub="VIP, Dubai, Retailer…" />
              <Choice active={f.audience.mode === "contacts"} onClick={() => setAud({ mode: "contacts" })} icon={<UserCheck />} title="Pick clients" sub={f.audience.contactIds.length ? `${num(f.audience.contactIds.length)} picked` : "Choose by hand"} />
            </div>

            {f.audience.mode === "tags" && (
              <div className="mt-4">
                {tagList.length === 0 ? (
                  <p className="text-sm text-ink-3">No tags yet. Add tags to clients, or tag a whole list when you import it.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {tagList.map(({ tag, count: n }) => {
                        const on = f.audience.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setAud({ tags: on ? f.audience.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...f.audience.tags, tag] })}
                            className={clsx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors", on ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong")}
                          >
                            {on && <Check className="size-3.5" />}
                            {tag} <span className={on ? "text-white/75" : "text-ink-3"}>{n}</span>
                          </button>
                        );
                      })}
                    </div>
                    {f.audience.tags.length > 1 && (
                      <div className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
                        Clients with
                        <Segmented value={f.audience.tagMatch} onChange={(v) => setAud({ tagMatch: v })} options={[{ value: "any", label: "any of these" }, { value: "all", label: "all of these" }]} />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {f.audience.mode === "contacts" && (
              <Button className="mt-4" icon={<Search className="size-4" />} onClick={() => setPickOpen(true)}>
                {f.audience.contactIds.length ? `Change selection (${num(f.audience.contactIds.length)})` : "Choose clients"}
              </Button>
            )}

            {tagList.length > 0 && (
              <div className="mt-4">
                <button type="button" onClick={() => setMoreAudience((v) => !v)} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-3 hover:text-ink">
                  <ChevronDown className={clsx("size-4 transition-transform", moreAudience && "rotate-180")} /> Leave out some tags {f.audience.excludeTags.length > 0 && `(${f.audience.excludeTags.length})`}
                </button>
                {moreAudience && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {tagList.map(({ tag }) => {
                      const on = f.audience.excludeTags.includes(tag);
                      return (
                        <button key={tag} type="button" onClick={() => setAud({ excludeTags: on ? f.audience.excludeTags.filter((t) => t !== tag) : [...f.audience.excludeTags, tag] })} className={clsx("rounded-full border px-3 py-1 text-[12px] font-medium", on ? "border-danger/40 bg-danger-soft text-danger line-through" : "border-line text-ink-2 hover:border-line-strong")}>
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-surface-2 px-4 py-3 text-[13px]">
              <span className="flex items-center gap-2 font-semibold text-ink">
                <Users className="size-4 text-brand" /> {aud.isFetching && !aud.data ? "…" : num(count)} client{count === 1 ? "" : "s"} will get this
              </span>
              {aud.data && aud.data.excluded.optedOut > 0 && <span className="text-ink-3">{num(aud.data.excluded.optedOut)} opted out — skipped</span>}
              {aud.data && aud.data.excluded.invalid > 0 && <span className="text-ink-3">{num(aud.data.excluded.invalid)} not on WhatsApp — skipped</span>}
              {aud.data && aud.data.excluded.excludedTag > 0 && <span className="text-ink-3">{num(aud.data.excluded.excludedTag)} left out by tag</span>}
            </div>
          </Section>

          {/* 2. Message */}
          <Section n={2} title="Write your message">
            <MessageComposer message={f.message} onMessage={(m) => set("message", m)} media={f.media} onMedia={(m) => set("media", m)} missing={aud.data?.missing} />
          </Section>

          {/* 3. When */}
          <Section n={3} title="When to send?">
            <Segmented
              value={f.when}
              onChange={(v) => set("when", v)}
              options={[
                { value: "now", label: <><Send className="size-3.5" /> Send now</> },
                { value: "later", label: <><CalendarClock className="size-3.5" /> Schedule</> },
              ]}
            />
            {f.when === "later" && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {quickTimes().map((q) => (
                    <button key={q.label} type="button" onClick={() => set("sendAt", toLocalInput(q.ms))} className={clsx("rounded-full border px-3 py-1.5 text-[13px] font-medium", toLocalInput(q.ms) === f.sendAt ? "border-brand bg-brand-soft text-brand-text" : "border-line text-ink-2 hover:border-line-strong")}>
                      {q.label}
                    </button>
                  ))}
                </div>
                <div className="max-w-xs">
                  <Label htmlFor="sendAt">Or pick a date and time</Label>
                  <input id="sendAt" type="datetime-local" className="field" value={f.sendAt} min={toLocalInput(Date.now())} onChange={(e) => set("sendAt", e.target.value)} />
                </div>
                <p className="text-[13px] text-ink-3">Starts <b className="text-ink-2">{friendlyWhen(sendAtMs)}</b> (your computer's time). The server must be running then.</p>
              </div>
            )}

            <div className="mt-6">
              <Label hint={`${num(count)} clients · ${duration(estimate)}`}>Sending speed</Label>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {(Object.keys(SPEEDS) as (keyof typeof SPEEDS)[]).map((k) => {
                  const s = SPEEDS[k];
                  const Icon = s.icon;
                  return (
                    <Choice key={k} active={f.speed === k} onClick={() => setF({ ...f, speed: k, minDelay: s.min, maxDelay: s.max })} icon={<Icon />} title={s.label} sub={`${s.min}–${s.max}s apart · ${s.note}`} />
                  );
                })}
              </div>
              <details className="mt-3 text-[13px]" open={f.speed === "custom"}>
                <summary className="cursor-pointer font-medium text-ink-3 hover:text-ink">Custom gap</summary>
                <div className="mt-2.5 flex items-center gap-2 text-ink-2">
                  Wait between
                  <input type="number" min={3} max={600} className="field w-20" value={f.minDelay} onChange={(e) => setF({ ...f, speed: "custom", minDelay: Number(e.target.value) })} />
                  and
                  <input type="number" min={3} max={900} className="field w-20" value={f.maxDelay} onChange={(e) => setF({ ...f, speed: "custom", maxDelay: Number(e.target.value) })} />
                  seconds
                </div>
              </details>
              {settings && (
                <p className="mt-3 flex items-start gap-1.5 text-[12px] text-ink-3">
                  <Info className="mt-px size-3.5 shrink-0" />
                  Daily limit {num(settings.dailyLimit)} messages{settings.window.enabled ? `, sending hours ${settings.window.start}–${settings.window.end}` : ""}. Change these in Settings.
                </p>
              )}
            </div>
          </Section>
        </div>

        {/* Preview column */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold"><Smartphone className="size-4 text-ink-3" /> Preview</h3>
            <div className="flex items-center gap-1">
              {(aud.data?.sample.length ?? 0) > 1 && (
                <select className="field h-8 w-auto max-w-40 !py-0 text-[12px]" value={previewIdx} onChange={(e) => setPreviewIdx(Number(e.target.value))} aria-label="Preview as">
                  {aud.data!.sample.map((c, i) => <option key={c.id} value={i}>{c.name || phone(c.phone)}</option>)}
                </select>
              )}
              {/\{[^{}]*\|[^{}]*\}/.test(f.message.replace(/\{\{[^}]*\}\}/g, "")) && (
                <button type="button" onClick={() => setShuffle((s) => s + 1)} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" title="Show another random version" aria-label="Show another random version">
                  <Shuffle className="size-4" />
                </button>
              )}
            </div>
          </div>
          <PhonePreview text={f.message.trim() ? render.data?.text ?? "" : ""} media={f.media} contactName={render.data?.contact.name} business={status?.businessName} />
          <Button className="mt-4 w-full" icon={<FlaskConical className="size-4" />} loading={test.isPending} disabled={(!f.message.trim() && !f.media) || status?.wa.status !== "connected"} onClick={() => test.mutate()}>
            Send a test to my WhatsApp
          </Button>
          {status?.wa.status !== "connected" && <p className="mt-2 text-center text-[12px] text-ink-3">Connect WhatsApp to send a test.</p>}
        </aside>
      </div>

      {/* Action bar */}
      <div className="fixed inset-x-0 bottom-[68px] z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-[260px]">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 lg:px-6">
          <div className="hidden min-w-0 flex-1 text-[13px] text-ink-3 sm:block">
            {problems.length ? <span className="text-warn">{problems[0]}</span> : <>Ready · {num(count)} clients · {duration(estimate)}</>}
          </div>
          <Button variant="ghost" loading={save.isPending && save.variables === "draft"} onClick={() => save.mutate("draft")} className="ml-auto sm:ml-0">
            Save draft
          </Button>
          <Button variant="primary" size="lg" icon={f.when === "later" ? <CalendarClock className="size-4" /> : <Zap className="size-4" />} loading={save.isPending && save.variables === "schedule"} onClick={launch} disabled={Boolean(problems.length)}>
            {f.when === "later" ? "Schedule" : `Send to ${num(count)}`}
          </Button>
        </div>
      </div>

      <ContactPicker open={pickOpen} initial={f.audience.contactIds} onClose={() => setPickOpen(false)} onDone={(ids) => { setAud({ mode: "contacts", contactIds: ids }); setPickOpen(false); }} />
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-[16px] font-semibold">
        <span className="flex size-7 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-bg">{n}</span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Choice({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
        active ? "border-brand bg-brand-soft/60 ring-1 ring-brand" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <span className={clsx("mt-0.5 [&>svg]:size-[18px]", active ? "text-brand-text" : "text-ink-3")}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        {sub && <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">{sub}</span>}
      </span>
    </button>
  );
}

function ContactPicker({ open, initial, onClose, onDone }: { open: boolean; initial: string[]; onClose: () => void; onDone: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [sel, setSel] = useState<Set<string>>(new Set(initial));
  useEffect(() => {
    if (open) setSel(new Set(initial));
    // Reset only when the picker opens, not on every re-render of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const { data } = useQuery({
    queryKey: ["picker", dq],
    queryFn: () => api<{ items: Contact[]; total: number }>(`/contacts?q=${encodeURIComponent(dq)}&status=active&pageSize=200&sort=name`),
    enabled: open,
  });
  const items = data?.items ?? [];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pick clients"
      size="md"
      footer={
        <>
          <span className="mr-auto self-center text-[13px] text-ink-3">{num(sel.size)} selected</span>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onDone([...sel])}>Done</Button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <input autoFocus className="field pl-9" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mb-2 flex gap-3 text-[12px] font-medium">
        <button className="text-brand-text hover:underline" onClick={() => setSel(new Set([...sel, ...items.map((c) => c.id)]))}>Select all shown</button>
        <button className="text-ink-3 hover:underline" onClick={() => setSel(new Set())}>Clear</button>
      </div>
      <ul className="-mx-2 max-h-[50vh] overflow-y-auto">
        {items.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
              <Checkbox checked={sel.has(c.id)} onChange={(v) => setSel((s) => { const n = new Set(s); if (v) n.add(c.id); else n.delete(c.id); return n; })} label={c.name} />
              <Avatar name={c.name} seed={c.id} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name || phone(c.phone)}</span>
                <span className="block truncate text-[12px] text-ink-3">{c.company || phone(c.phone)}</span>
              </span>
            </label>
          </li>
        ))}
        {data && data.total > items.length && <li className="px-2 py-2 text-[12px] text-ink-3">Showing {items.length} of {num(data.total)} — search to find more.</li>}
      </ul>
    </Modal>
  );
}
