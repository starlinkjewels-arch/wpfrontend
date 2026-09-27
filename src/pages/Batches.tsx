import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Layers, Plus, Search, Send, Users, Megaphone, CalendarClock, MessageCircleReply, Info } from "lucide-react";
import { api, type Batch } from "../lib/api";
import { useDebounced } from "../lib/hooks";
import { batchColor } from "../lib/batchColors";
import { ago, num, pct } from "../lib/format";
import { Badge, Button, Callout, Card, Empty, Loading, PageHeader } from "../components/ui";
import { BatchFormModal } from "../components/BatchModals";

/**
 * Named lists of clients, each with its history of broadcasts. Made on the
 * Clients page (select → Add to batch) or here.
 */
export function BatchesPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [creating, setCreating] = useState(false);
  const location = useLocation();
  useEffect(() => {
    if ((location.state as { create?: boolean } | null)?.create) {
      setCreating(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, isLoading } = useQuery({ queryKey: ["batches", dq], queryFn: () => api<{ items: Batch[] }>(`/batches?q=${encodeURIComponent(dq)}`) });
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Batches"
        subtitle="Named lists of clients — with every broadcast they received, and how they responded."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New batch</Button>}
      />

      {isLoading ? (
        <Loading />
      ) : !items.length && !dq ? (
        <Card>
          <Empty
            icon={<Layers className="size-6" />}
            title="No batches yet"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" icon={<Users className="size-4" />} onClick={() => navigate("/clients")}>Select clients</Button>
                <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Create an empty batch</Button>
              </div>
            }
          >
            On the Clients page, tick the clients you want, then choose <b>Add to batch</b>. Give it a name like “Dubai VIP buyers” and send broadcasts to it any time — every send is recorded here.
          </Empty>
        </Card>
      ) : (
        <>
          <div className="relative mb-5 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input className="field h-10 pl-9" placeholder="Search batches" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-3">No batch matches “{dq}”.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {items.map((b) => <BatchCard key={b.id} b={b} />)}
            </div>
          )}
          <Callout tone="neutral" icon={<Info />} className="mt-6">
            To add clients to a batch: open <Link to="/clients" className="font-semibold text-brand-text underline">Clients</Link>, tick them (or filter and “select all matching”), then press <b>Add to batch</b>.
          </Callout>
        </>
      )}
      <BatchFormModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function BatchCard({ b }: { b: Batch }) {
  const navigate = useNavigate();
  const col = batchColor(b.color);
  const t = b.totals;
  return (
    <Card className="group relative flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-pop">
      <div className={clsx("h-1.5 bg-gradient-to-r", col.tile)} />
      <Link to={`/batches/${b.id}`} className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <span className={clsx("flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", col.tile)}>
            <Layers className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[17px] font-extrabold tracking-tight text-ink">{b.name}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-3"><Users className="size-3.5" /> {num(b.members)} client{b.members === 1 ? "" : "s"}</p>
          </div>
          {b.scheduled > 0 && <Badge tone="info"><CalendarClock className="size-3" />{b.scheduled} upcoming</Badge>}
        </div>
        {b.description && <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-ink-2">{b.description}</p>}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Mini label="Broadcasts" value={num(t.broadcasts)} icon={<Megaphone />} />
          <Mini label="Messages" value={num(t.sent)} icon={<Send />} />
          <Mini label="Replied" value={t.sent ? `${pct(t.replied, t.sent)}%` : "—"} icon={<MessageCircleReply />} />
        </div>
        <p className="mt-4 truncate text-[12px] text-ink-3">
          {b.lastSentAt ? <>Last sent {ago(b.lastSentAt)} · <span className="text-ink-2">{b.lastBroadcastName}</span></> : "Nothing sent to this batch yet"}
        </p>
      </Link>
      <div className="flex items-center gap-2 border-t border-line px-5 py-3">
        <Button size="sm" variant="primary" icon={<Send className="size-3.5" />} disabled={!b.members} onClick={() => navigate("/campaigns/new", { state: { batchIds: [b.id] } })}>
          Send broadcast
        </Button>
        <Button size="sm" variant="ghost" onClick={() => navigate(`/batches/${b.id}`)}>History</Button>
      </div>
    </Card>
  );
}

function Mini({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="flex items-center gap-1 text-[11px] text-ink-3 [&>svg]:size-3">{icon}<span className="truncate">{label}</span></div>
      <div className="mt-0.5 font-display text-base font-extrabold tracking-tight">{value}</div>
    </div>
  );
}
