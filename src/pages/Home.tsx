import { Link, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowRight, Check, FileSpreadsheet, Megaphone, MessageCircle, Plus, QrCode, Sparkles, Users, X, CalendarClock, Send } from "lucide-react";
import { api, put, type Campaign, type Contact, type Counts, type Day, type Health, type LeadBoard, type Savings } from "../lib/api";
import { Radar, BadgeIndianRupee, CheckCircle2 } from "lucide-react";
import { INTENT_LABEL, LeadBadge, WaitingChip, money } from "../components/LeadBits";
import { ShieldCheck, ShieldAlert, AlertTriangle, TrendingUp } from "lucide-react";
import { useNow, useStatus } from "../lib/hooks";
import { Avatar, Button, Card, CardHeader, Loading, Progress, Badge } from "../components/ui";
import { SentChart } from "../components/SentChart";
import { CampaignCard } from "../components/CampaignBits";
import { ago, flag, num, pct, phone } from "../lib/format";

type Dashboard = {
  counts: Counts;
  today: Day;
  dailyLimit: number;
  chart: Day[];
  active: Campaign[];
  upcoming: Campaign[];
  recent: Campaign[];
  recentInquiries: Contact[];
  unread: number;
  onboarding: { connected: boolean; hasContacts: boolean; hasCampaign: boolean; dismissed: boolean };
  health: Health;
  leads: LeadBoard;
  savings: Savings;
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function HomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: status } = useStatus();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard"), refetchInterval: 5000 });
  const dismiss = useMutation({
    mutationFn: () => put("/settings", { onboardingDismissed: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  if (isLoading || !data) return <Loading />;
  const ob = data.onboarding;
  const showSetup = !ob.dismissed && !(ob.connected && ob.hasContacts && ob.hasCampaign);
  const week = data.chart.slice(-7);
  const weekSent = week.reduce((a, d) => a + d.sent, 0);
  const weekReplies = week.reduce((a, d) => a + d.inbound, 0);
  const live = data.active;

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-1 font-display text-[30px] font-extrabold leading-tight tracking-tight sm:text-[36px]">
            <span className="text-brand-gradient">{greeting()}</span>
            <span className="text-pink-500">.</span>
          </h1>
        </div>
        <div className="flex gap-2">
          <Button icon={<FileSpreadsheet className="size-4" />} onClick={() => navigate("/clients/import")}>
            Import clients
          </Button>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => navigate("/campaigns/new")}>
            New broadcast
          </Button>
        </div>
      </div>

      {showSetup && (
        <Card className="relative mb-6 overflow-hidden p-6">
          <div aria-hidden className="absolute -right-10 -top-16 size-56 rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(var(--gold-soft), transparent 70%)" }} />
          <button onClick={() => dismiss.mutate()} className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Hide setup guide">
            <X className="size-4" />
          </button>
          <div className="relative flex items-center gap-2 text-[13px] font-semibold text-gold">
            <Sparkles className="size-4" /> Get started in 3 steps
          </div>
          <div className="relative mt-4 grid gap-3 md:grid-cols-3">
            <SetupStep n={1} done={ob.connected} title="Connect WhatsApp" text="Scan a QR code with your business phone." cta="Connect" onClick={() => navigate("/whatsapp")} icon={<QrCode className="size-4" />} />
            <SetupStep n={2} done={ob.hasContacts} title="Add your clients" text="Upload your Excel sheet — we clean the numbers." cta="Import Excel" onClick={() => navigate("/clients/import")} icon={<FileSpreadsheet className="size-4" />} />
            <SetupStep n={3} done={ob.hasCampaign} title="Send a campaign" text="Write once, every client gets it by name." cta="Create" onClick={() => navigate("/campaigns/new")} icon={<Megaphone className="size-4" />} />
          </div>
        </Card>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        <Kpi label="Clients" value={num(data.counts.total)} sub={`${num(data.counts.active)} can receive messages`} icon={<Users />} to="/clients" tone="violet" />
        <Kpi
          label="Sent today"
          value={num(data.today.sent)}
          sub={
            <span className="block">
              <Progress value={pct(data.today.sent, data.dailyLimit)} className="mt-2 h-1.5" tone={data.today.sent >= data.dailyLimit * 0.9 ? "gold" : "brand"} />
              <span className="mt-1.5 block">of {num(data.dailyLimit)} daily limit</span>
            </span>
          }
          icon={<Send />}
          tone="blue"
        />
        <Kpi label="Replies today" value={num(data.today.inbound)} sub={data.unread ? `${data.unread} chats unread` : "All caught up"} icon={<MessageCircle />} to="/inbox" highlight={data.unread > 0} tone="pink" />
        <Kpi label="Scheduled" value={num(data.upcoming.length)} sub={data.upcoming[0] ? `Next: ${data.upcoming[0].name}` : "Nothing scheduled"} icon={<CalendarClock />} to="/campaigns" tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          {data.leads.enabled !== false && <LeadRadarCard board={data.leads} />}

          {live.length > 0 && (
            <section>
              <SectionTitle title="Live now" to="/campaigns" />
              <div className="grid gap-3 md:grid-cols-2">{live.map((c) => <CampaignCard key={c.id} c={c} />)}</div>
            </section>
          )}

          <Card>
            <CardHeader
              title="Messages sent"
              subtitle={`Last 14 days · ${num(weekSent)} sent and ${num(weekReplies)} replies this week`}
            />
            <div className="px-5 pb-4 pt-6">
              <SentChart days={data.chart} />
            </div>
          </Card>

          {data.upcoming.length > 0 && (
            <section>
              <SectionTitle title="Coming up" to="/campaigns" />
              <div className="grid gap-3 md:grid-cols-2">{data.upcoming.slice(0, 4).map((c) => <CampaignCard key={c.id} c={c} />)}</div>
            </section>
          )}
          {!live.length && !data.upcoming.length && data.recent.length > 0 && (
            <section>
              <SectionTitle title="Recently sent" to="/campaigns" />
              <div className="grid gap-3 md:grid-cols-2">{data.recent.map((c) => <CampaignCard key={c.id} c={c} />)}</div>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <SavingsCard s={data.savings} />
          <HealthCard health={data.health} />

          <Card>
            <CardHeader
              title="New enquiries"
              subtitle="People who messaged you first — saved as clients automatically"
              action={<Link to="/clients?source=inbound" className="shrink-0 text-[13px] font-medium text-brand-text hover:underline">All</Link>}
            />
            <div className="mt-3 pb-2">
              {data.recentInquiries.length === 0 ? (
                <p className="px-5 pb-5 pt-2 text-sm text-ink-3">When someone new writes to your WhatsApp, they appear here.</p>
              ) : (
                data.recentInquiries.map((c) => (
                  <Link key={c.id} to={`/inbox/${c.id}`} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2">
                    <Avatar name={c.name} seed={c.id} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{c.name || phone(c.phone)}</div>
                      <div className="truncate text-[12px] text-ink-3">{flag(c.country)} {phone(c.phone)}</div>
                    </div>
                    <span className="shrink-0 text-[12px] text-ink-3">{ago(c.createdAt)}</span>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Your number</h3>
              {status?.wa.status === "connected" ? <Badge tone="brand" dot>Connected</Badge> : <Badge tone="danger" dot>Offline</Badge>}
            </div>
            <p className="mt-2 text-xl font-semibold tracking-tight">{status?.wa.phoneDisplay ?? "Not connected"}</p>
            <p className="mt-1 text-[13px] text-ink-3">
              {status?.wa.status === "connected" ? "Campaigns send from this number." : "Connect to start sending."}
            </p>
            <Link to="/whatsapp" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-brand-text hover:underline">
              Manage connection <ArrowRight className="size-3.5" />
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}

/** Who is waiting for an answer — hot buyers first. */
function LeadRadarCard({ board }: { board: LeadBoard }) {
  const now = useNow(30000);
  const rows = board.items.filter((r) => r.waiting).slice(0, 5);
  return (
    <Card className={clsx("overflow-hidden", board.counts.hotWaiting > 0 && "ring-2 ring-rose-400/40")}>
      <CardHeader
        title={<span className="inline-flex items-center gap-2"><Radar className="size-4 text-brand" /> Lead Radar</span>}
        subtitle={
          board.counts.waiting
            ? <>{board.counts.hotWaiting > 0 && <b className="text-rose-500">{board.counts.hotWaiting} hot buyer{board.counts.hotWaiting === 1 ? "" : "s"} waiting · </b>}{board.counts.waiting} waiting for your reply</>
            : "Nobody is waiting for you — every buyer has an answer"
        }
        action={<Link to="/leads" className="shrink-0 text-[13px] font-medium text-brand-text hover:underline">Open</Link>}
      />
      {rows.length === 0 ? (
        <div className="flex items-center gap-3 px-5 pb-5 pt-3 text-[13px] text-ink-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text"><CheckCircle2 className="size-[18px]" /></span>
          Every message from a client is read and sorted: price, stock, catalogue or order requests are <b className="mx-1">hot</b> and show up here first.
        </div>
      ) : (
        <ul className="mt-2 pb-2">
          {rows.map((r) => (
            <li key={r.key}>
              <Link to={`/inbox/${r.key}`} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2">
                <Avatar name={r.name} seed={r.key} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{r.name || phone(r.key)}</span>
                    <LeadBadge level={r.lead.level} />
                  </div>
                  <div className="truncate text-[12px] text-ink-2">
                    <b className="font-medium">{INTENT_LABEL[r.lead.intent]}</b>{r.lead.summary ? ` — ${r.lead.summary}` : ""}
                  </div>
                </div>
                {r.waitingSince && <WaitingChip since={r.waitingSince} alertHours={board.alertHours} now={now} />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * The plainest reason to use this over an official-API tool: what the same
 * messages would have cost there, at Meta's rate for each client's country.
 */
function SavingsCard({ s }: { s: Savings }) {
  const total = money(s.inr, s.usd);
  const month = money(s.monthInr, s.monthUsd);
  const each = money(s.perBroadcast.inr, s.perBroadcast.usd);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-brand-gradient p-5 text-white shadow-lg shadow-violet-500/25">
      <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
      <div className="relative flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">Saved vs the official API</h3>
        <BadgeIndianRupee className="size-5 text-white/80" />
      </div>
      <div className="relative mt-3 font-display text-[34px] font-extrabold leading-none tracking-tight">{total.inr}</div>
      <p className="relative mt-1.5 text-[13px] text-white/80">
        ≈ {total.usd} on {num(s.messages)} broadcast messages{s.monthUsd > 0 ? ` · ${month.inr} this month` : ""}
      </p>
      {s.perBroadcast.clients > 0 && (
        <p className="relative mt-3 rounded-xl bg-white/15 px-3 py-2 text-[12.5px] leading-snug">
          Every broadcast to all <b>{num(s.perBroadcast.clients)}</b> clients saves <b>{each.inr}</b> <span className="text-white/75">(≈ {each.usd})</span>
        </p>
      )}
      <ul className="relative mt-4 space-y-1.5 border-t border-white/20 pt-3 text-[12px] text-white/90">
        {["No charge per message — your own number", "Post in WhatsApp groups and Status (the API can't)", "No template approval — send any message, any time"].map((t) => (
          <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 size-3.5 shrink-0" />{t}</li>
        ))}
      </ul>
      <p className="relative mt-3 text-[11px] text-white/65" title={`Meta’s marketing-message price for each recipient’s country, before any provider’s fees. Rupees at ₹${s.usdInr} per dollar.`}>
        At Meta's rate for each client's country (card of {new Date(s.ratesAsOf).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}), before provider fees.
      </p>
    </div>
  );
}

const VERDICT = {
  good: { label: "Healthy", tone: "brand" as const, icon: ShieldCheck, line: "Your number is sending safely." },
  watch: { label: "Keep an eye on it", tone: "warn" as const, icon: AlertTriangle, line: "A few things could put your number at risk." },
  risk: { label: "At risk", tone: "danger" as const, icon: ShieldAlert, line: "WhatsApp may restrict this number if this continues." },
};

/**
 * The signals WhatsApp watches — replies, opt-outs, dead numbers, unanswered
 * messages — for the last 30 days, with what to do about each.
 */
function HealthCard({ health }: { health: Health }) {
  const v = VERDICT[health.verdict];
  const Icon = v.icon;
  const p = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
  const t = health.totals;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 basis-40">
          <h3 className="text-[15px] font-semibold">Account health</h3>
          <p className="mt-0.5 text-[13px] text-ink-3">{v.line}</p>
        </div>
        <Badge tone={v.tone}><Icon className="size-3.5" />{v.label}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Reply rate" value={p(health.rates.reply)} good={(health.rates.reply ?? 1) >= 0.1} hint={`${num(t.replied)} of ${num(t.sent)}`} />
        <Metric label="Read rate" value={p(health.rates.read)} good={(health.rates.read ?? 1) >= 0.5} hint={`${num(t.read)} read`} />
        <Metric label="Opted out" value={p(health.rates.optOut)} good={(health.rates.optOut ?? 0) <= 0.01} hint={`${num(t.optedOut)} client${t.optedOut === 1 ? "" : "s"}`} />
        <Metric label="Not on WhatsApp" value={p(health.rates.fail)} good={(health.rates.fail ?? 0) <= 0.05} hint={`${num(t.failed)} number${t.failed === 1 ? "" : "s"}`} />
      </div>
      <p className="mt-2 text-[11px] text-ink-3">Campaigns started in the last 30 days.</p>

      <div className="mt-4 space-y-2 border-t border-line pt-4 text-[13px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-2">Unanswered this month</span>
          <b className={health.unanswered >= 500 ? "text-warn" : "text-ink"}>{num(health.unanswered)}</b>
        </div>
        {health.cap.day && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-ink-2"><TrendingUp className="size-3.5 text-brand" /> Warm-up</span>
            <b className="text-ink">Day {health.cap.day} · {num(health.cap.limit)} today</b>
          </div>
        )}
        {health.ignoring > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-2">Clients ignoring campaigns</span>
            <b className="text-ink">{num(health.ignoring)}</b>
          </div>
        )}
      </div>

      {health.checks.length > 0 && (
        <ul className="mt-4 space-y-2">
          {health.checks.slice(0, 3).map((c) => (
            <li key={c.title} className={clsx("rounded-lg px-3 py-2 text-[12px]", c.level === "bad" ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn")}>
              <b className="block text-[13px]">{c.title}</b>
              {c.tip}
            </li>
          ))}
        </ul>
      )}
      <Link to="/settings#safety" className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-brand-text hover:underline">
        Sending safety settings <ArrowRight className="size-3.5" />
      </Link>
    </Card>
  );
}

function Metric({ label, value, good, hint }: { label: string; value: string; good: boolean; hint: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className={clsx("mt-0.5 text-lg font-semibold tracking-tight", value !== "—" && !good && "text-warn")}>{value}</div>
      <div className="text-[11px] text-ink-3">{hint}</div>
    </div>
  );
}

function SectionTitle({ title, to }: { title: string; to: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <Link to={to} className="text-[13px] font-medium text-brand-text hover:underline">View all</Link>
    </div>
  );
}

/* Each tile has its own colour, so the four numbers read apart at a glance. */
const KPI_TONES = {
  violet: { tile: "from-violet-500 to-indigo-500", glow: "rgba(124,92,255,.35)" },
  blue: { tile: "from-sky-500 to-blue-600", glow: "rgba(59,130,246,.35)" },
  pink: { tile: "from-pink-500 to-rose-500", glow: "rgba(236,72,153,.35)" },
  amber: { tile: "from-amber-400 to-orange-500", glow: "rgba(245,158,11,.35)" },
};

function Kpi({ label, value, sub, icon, to, highlight, tone = "violet" }: { label: string; value: string; sub: React.ReactNode; icon: React.ReactNode; to?: string; highlight?: boolean; tone?: keyof typeof KPI_TONES }) {
  const t = KPI_TONES[tone];
  const body = (
    <Card className={clsx("group relative h-full overflow-hidden p-4 transition-all sm:p-5", to && "hover:-translate-y-0.5 hover:shadow-pop", highlight && "ring-2 ring-pink-400/40")}>
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full opacity-60 blur-2xl" style={{ background: t.glow }} />
      <div className="relative flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink-2">{label}</span>
        <span className={clsx("flex size-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg [&>svg]:size-[18px]", t.tile)}>{icon}</span>
      </div>
      <div className="relative mt-3 font-display text-[30px] font-extrabold leading-none tracking-tight text-ink sm:text-[34px]">{value}</div>
      <div className="relative mt-2 truncate text-[12px] text-ink-3">{sub}</div>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function SetupStep({ n, done, title, text, cta, onClick, icon }: { n: number; done: boolean; title: string; text: string; cta: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <div className={clsx("flex flex-col rounded-xl border p-4", done ? "border-brand/25 bg-brand-soft/50" : "border-line bg-surface")}>
      <div className="flex items-center gap-2.5">
        <span className={clsx("flex size-7 items-center justify-center rounded-full text-[13px] font-semibold", done ? "bg-brand text-white" : "bg-surface-2 text-ink-2")}>
          {done ? <Check className="size-4" /> : n}
        </span>
        <span className={clsx("text-sm font-semibold", done && "text-brand-text")}>{title}</span>
      </div>
      <p className="mt-2 flex-1 text-[13px] text-ink-2">{text}</p>
      {!done && (
        <Button size="sm" variant="soft" className="mt-3 self-start" icon={icon} onClick={onClick}>
          {cta}
        </Button>
      )}
    </div>
  );
}
