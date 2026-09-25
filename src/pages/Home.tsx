import { Link, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowRight, Check, FileSpreadsheet, Megaphone, MessageCircle, Plus, QrCode, Sparkles, Users, X, CalendarClock, Send } from "lucide-react";
import { api, put, type Campaign, type Contact, type Counts, type Day } from "../lib/api";
import { useStatus } from "../lib/hooks";
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
          <h1 className="mt-1 font-display text-[30px] font-medium leading-tight tracking-tight sm:text-[36px]">
            {greeting()}
            <span className="text-gold">.</span>
          </h1>
        </div>
        <div className="flex gap-2">
          <Button icon={<FileSpreadsheet className="size-4" />} onClick={() => navigate("/clients/import")}>
            Import clients
          </Button>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => navigate("/campaigns/new")}>
            New campaign
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Kpi label="Clients" value={num(data.counts.total)} sub={`${num(data.counts.active)} can receive messages`} icon={<Users />} to="/clients" />
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
        />
        <Kpi label="Replies today" value={num(data.today.inbound)} sub={data.unread ? `${data.unread} chats unread` : "All caught up"} icon={<MessageCircle />} to="/inbox" highlight={data.unread > 0} />
        <Kpi label="Scheduled" value={num(data.upcoming.length)} sub={data.upcoming[0] ? `Next: ${data.upcoming[0].name}` : "Nothing scheduled"} icon={<CalendarClock />} to="/campaigns" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
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

function SectionTitle({ title, to }: { title: string; to: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <Link to={to} className="text-[13px] font-medium text-brand-text hover:underline">View all</Link>
    </div>
  );
}

function Kpi({ label, value, sub, icon, to, highlight }: { label: string; value: string; sub: React.ReactNode; icon: React.ReactNode; to?: string; highlight?: boolean }) {
  const body = (
    <Card className={clsx("h-full p-4 transition-colors sm:p-5", to && "hover:border-line-strong", highlight && "ring-2 ring-brand/30")}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        <span className="text-ink-3 [&>svg]:size-4">{icon}</span>
      </div>
      <div className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-ink sm:text-[32px]">{value}</div>
      <div className="mt-2 truncate text-[12px] text-ink-3">{sub}</div>
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
