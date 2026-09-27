import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Plus, CircleDashed, UsersRound, Info, X } from "lucide-react";
import { StatusComposer } from "../components/StatusComposer";
import { local } from "../lib/storage";
import { api, type Campaign } from "../lib/api";
import { Button, Card, Empty, Loading, PageHeader, Segmented } from "../components/ui";
import { CampaignCard } from "../components/CampaignBits";

type Filter = "all" | "active" | "draft" | "completed";

export function CampaignsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [statusOpen, setStatusOpen] = useState(false);
  const [hideTip, setHideTip] = useState(() => local.get("sl.hide-broadcast-tip", false));
  const { data, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api<{ items: Campaign[] }>("/campaigns"),
    refetchInterval: 3000,
  });
  const items = data?.items ?? [];
  const isActive = (c: Campaign) => ["running", "queued", "paused", "scheduled"].includes(c.status);
  const shown = items.filter((c) =>
    filter === "all" ? true : filter === "active" ? isActive(c) : filter === "draft" ? c.status === "draft" : c.status === "completed" || c.status === "cancelled",
  );
  const count = (fn: (c: Campaign) => boolean) => items.filter(fn).length;

  return (
    <>
      <PageHeader
        title="Broadcasts"
        subtitle="One message to many clients or groups — personalised, sent one by one at a safe pace."
        actions={
          <>
            <Button icon={<CircleDashed className="size-4" />} onClick={() => setStatusOpen(true)}>Post to Status</Button>
            <Button icon={<UsersRound className="size-4" />} onClick={() => navigate("/groups")} className="max-sm:!hidden">Groups</Button>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => navigate("/campaigns/new")}>New broadcast</Button>
          </>
        }
      />
      {!hideTip && (
        <div className="mb-5 flex items-start gap-3 rounded-xl bg-info-soft px-4 py-3 text-[13px] text-info">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">
            <b>Better than a WhatsApp broadcast list.</b> WhatsApp's own lists only reach people who saved your number. Broadcasts here go to each client individually — everyone receives them, with their own name — and can also post into your WhatsApp groups.
          </span>
          <button onClick={() => { setHideTip(true); local.set("sl.hide-broadcast-tip", true); }} className="text-info/70 hover:text-info" aria-label="Hide tip"><X className="size-4" /></button>
        </div>
      )}
      <StatusComposer open={statusOpen} onClose={() => setStatusOpen(false)} />
      {isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Card>
          <Empty icon={<Megaphone className="size-6" />} title="No broadcasts yet" action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => navigate("/campaigns/new")}>Create your first broadcast</Button>}>
            Announce a new collection, share a price list or invite buyers to a show — every client gets it with their own name.
          </Empty>
        </Card>
      ) : (
        <>
          <div className="scroll-thin -mx-4 mb-5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: items.length },
                { value: "active", label: "Live & scheduled", count: count(isActive) },
                { value: "draft", label: "Drafts", count: count((c) => c.status === "draft") },
                { value: "completed", label: "Finished", count: count((c) => c.status === "completed" || c.status === "cancelled") },
              ]}
            />
          </div>
          {shown.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-3">Nothing here.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{shown.map((c) => <CampaignCard key={c.id} c={c} />)}</div>
          )}
        </>
      )}
    </>
  );
}
