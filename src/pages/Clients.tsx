import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Megaphone, MoreHorizontal, Plus, Search, Tag as TagIcon, Trash2, UserPlus, Users, X, BellOff, Bell, ChevronLeft, ChevronRight, Sparkles, ShieldCheck, CheckCheck, Loader2 } from "lucide-react";
import { api, post, type Contact, type Counts, type VerifyJob } from "../lib/api";
import { useDebounced, useMeta } from "../lib/hooks";
import { Avatar, Badge, Button, Card, Checkbox, Empty, Loading, Menu, MenuItem, Modal, PageHeader, Progress, Segmented, Tag, useConfirm, Label } from "../components/ui";
import { ClientDrawer } from "../components/ClientDrawer";
import { TagInput } from "../components/TagInput";
import { ago, countryName, flag, num, pct, phone } from "../lib/format";
import { exportContacts } from "../lib/excel";
import { local } from "../lib/storage";

type ListRes = { items: Contact[]; total: number; page: number; pageSize: number; counts: Counts };
type StatusFilter = "all" | "active" | "optedOut" | "invalid";

const PAGE = 50;

export function ClientsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const dq = useDebounced(q);
  const [status, setStatus] = useState<StatusFilter>(local.get("sl.clients.status", "all"));
  const [tags, setTags] = useState<string[]>(params.get("tag")?.split(",").filter(Boolean) ?? []);
  const source = params.get("source") ?? "";
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [drawer, setDrawer] = useState<{ open: boolean; contact: Contact | null }>({ open: false, contact: null });
  const [tagModal, setTagModal] = useState<null | "addTags" | "removeTags">(null);

  const { data: meta } = useMeta();
  const filterQs = useMemo(() => {
    const s = new URLSearchParams();
    if (dq) s.set("q", dq);
    if (tags.length) s.set("tag", tags.join(","));
    if (status !== "all") s.set("status", status);
    if (source) s.set("source", source);
    return s.toString();
  }, [dq, tags, status, source]);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", filterQs, page],
    queryFn: () => api<ListRes>(`/contacts?${filterQs}&page=${page}&pageSize=${PAGE}`),
    placeholderData: keepPreviousData,
  });

  // Filters changed: back to page 1, selection cleared.
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
    setAllMatching(false);
  }, [filterQs]);
  useEffect(() => local.set("sl.clients.status", status), [status]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageIds = items.map((c) => c.id);
  const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const selCount = allMatching ? total : selected.size;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      setAllMatching(false);
      return n;
    });

  const selectPage = (v: boolean) => {
    setAllMatching(false);
    setSelected((s) => {
      const n = new Set(s);
      pageIds.forEach((id) => (v ? n.add(id) : n.delete(id)));
      return n;
    });
  };

  const selectionBody = () => (allMatching ? { filter: Object.fromEntries(new URLSearchParams(filterQs)) } : { ids: [...selected] });

  const verify = useMutation({
    mutationFn: () => post<{ job: VerifyJob }>("/contacts/verify", selectionBody()),
    onSuccess: (r) => {
      setSelected(new Set());
      setAllMatching(false);
      qc.setQueryData(["verify"], r);
      qc.invalidateQueries({ queryKey: ["verify"] });
      if (!r.job.total) toast.info("All of these were checked in the last 30 days");
      else toast.success(`Checking ${num(r.job.total)} numbers — about ${Math.max(1, Math.round((r.job.total * 2.5) / 60))} min`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: (body: Record<string, unknown>) => post<{ count: number }>("/contacts/bulk", { ...selectionBody(), ...body }),
    onSuccess: (res, body) => {
      const verb = { delete: "Deleted", addTags: "Tagged", removeTags: "Updated", optOut: "Opted out", optIn: "Opted in" }[body.action as string] ?? "Updated";
      toast.success(`${verb} ${num(res.count)} client${res.count === 1 ? "" : "s"}`);
      setSelected(new Set());
      setAllMatching(false);
      // Deleting a whole page would otherwise leave you on an empty one.
      if (body.action === "delete") setPage(1);
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["contacts-meta"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* Deleting everyone in the list is said in so many words, so "select all
     matching" with no filter on can never be mistaken for deleting a few. */
  async function deleteSelected() {
    const everyone = allMatching && !filtering && selCount === (counts?.total ?? -1);
    const ok = await confirm({
      title: everyone ? `Delete ALL ${num(selCount)} clients?` : `Delete ${num(selCount)} client${selCount === 1 ? "" : "s"}?`,
      body: (
        <div className="space-y-1.5">
          {everyone && <p className="font-semibold text-danger">This empties your whole client list.</p>}
          <p>This cannot be undone. They are removed from future campaigns; campaigns already sent keep their results, and their chats stay in the inbox.</p>
        </div>
      ),
      confirm: everyone ? "Delete all clients" : `Delete ${num(selCount)}`,
      danger: true,
    });
    if (ok) bulk.mutate({ action: "delete" });
  }

  async function campaignToSelected() {
    let ids = [...selected];
    if (allMatching) ids = (await api<{ ids: string[] }>(`/contacts/ids?${filterQs}`)).ids;
    navigate("/campaigns/new", { state: { contactIds: ids } });
  }

  async function doExport() {
    const res = await api<{ items: Contact[] }>(`/contacts/export?${filterQs}`);
    await exportContacts(res.items, `clients-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${num(res.items.length)} clients`);
  }

  const counts = data?.counts ?? meta?.counts;
  const noClientsAtAll = counts?.total === 0;
  const filtering = Boolean(dq || tags.length || status !== "all" || source);

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={counts ? `${num(counts.total)} clients · ${num(counts.active)} can receive campaigns` : "Your buyers and enquiries"}
        actions={
          <>
            <Button icon={<Download className="size-4" />} onClick={doExport} disabled={!total} className="max-sm:!hidden">Export</Button>
            <Button icon={<FileSpreadsheet className="size-4" />} onClick={() => navigate("/clients/import")}>Import Excel</Button>
            <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setDrawer({ open: true, contact: null })}>Add client</Button>
          </>
        }
      />

      {noClientsAtAll ? (
        <Card>
          <Empty
            icon={<Users className="size-6" />}
            title="No clients yet"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" icon={<FileSpreadsheet className="size-4" />} onClick={() => navigate("/clients/import")}>Import from Excel</Button>
                <Button icon={<Plus className="size-4" />} onClick={() => setDrawer({ open: true, contact: null })}>Add one by hand</Button>
              </div>
            }
          >
            Upload your client list from Excel — names, numbers from any country, companies, anything else you keep. People who message you will also appear here by themselves.
          </Empty>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input className="field h-10 pl-9" placeholder="Search name, company, number, city…" value={q} onChange={(e) => setQ(e.target.value)} />
              {q && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink" onClick={() => setQ("")} aria-label="Clear search">
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="scroll-thin -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
              <Segmented<StatusFilter>
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "All", count: counts?.total },
                  { value: "active", label: "Active", count: counts?.active },
                  { value: "optedOut", label: "Opted out", count: counts?.optedOut },
                  { value: "invalid", label: "Not on WhatsApp", count: counts?.invalid },
                ]}
              />
            </div>
          </div>

          <VerifyBanner />

          {(meta?.tags.length ?? 0) > 0 && (
            <div className="scroll-thin -mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
              <TagIcon className="size-4 shrink-0 text-ink-3" />
              {source === "inbound" && (
                <button onClick={() => setParams({})} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/40 bg-gold-soft px-3 py-1 text-[12px] font-medium text-gold">
                  <Sparkles className="size-3.5" /> Wrote to us first <X className="size-3.5" />
                </button>
              )}
              {meta!.tags.slice(0, 30).map(({ tag, count }) => {
                const on = tags.some((t) => t.toLowerCase() === tag.toLowerCase());
                return (
                  <button
                    key={tag}
                    onClick={() => setTags(on ? tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...tags, tag])}
                    className={clsx(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                      on ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                    )}
                  >
                    {tag} <span className={on ? "text-white/75" : "text-ink-3"}>{count}</span>
                  </button>
                );
              })}
              {tags.length > 0 && (
                <button onClick={() => setTags([])} className="shrink-0 text-[12px] font-medium text-ink-3 hover:text-ink">Clear</button>
              )}
            </div>
          )}

          <Card className="overflow-hidden">
            {/* Select-all strip */}
            {selected.size > 0 && pageAllSelected && total > items.length && (
              <div className="border-b border-line bg-brand-soft px-4 py-2 text-center text-[13px] text-brand-text">
                {allMatching ? (
                  <>All <b>{num(total)}</b> matching clients are selected. <button className="font-semibold underline" onClick={() => { setAllMatching(false); setSelected(new Set()); }}>Clear</button></>
                ) : (
                  <>{num(selected.size)} on this page selected. <button className="font-semibold underline" onClick={() => setAllMatching(true)}>Select all {num(total)} matching</button></>
                )}
              </div>
            )}

            {isLoading ? (
              <Loading />
            ) : items.length === 0 ? (
              <Empty icon={<Search className="size-6" />} title="No clients match" action={filtering ? <Button onClick={() => { setQ(""); setTags([]); setStatus("all"); setParams({}); }}>Clear filters</Button> : undefined}>
                Try a different search or remove a filter.
              </Empty>
            ) : (
              <>
                {/* Desktop table */}
                <table className="hidden w-full text-left text-sm md:table">
                  <thead>
                    <tr className="border-b border-line text-[12px] font-medium text-ink-3">
                      <th className="w-10 py-3 pl-4">
                        <Checkbox
                          label="Select page"
                          checked={pageAllSelected}
                          indeterminate={!pageAllSelected && pageIds.some((id) => selected.has(id))}
                          onChange={selectPage}
                        />
                      </th>
                      <th className="py-3 pr-3 font-medium">Client</th>
                      <th className="py-3 pr-3 font-medium">WhatsApp</th>
                      <th className="py-3 pr-3 font-medium">Tags</th>
                      <th className="py-3 pr-3 font-medium">Status</th>
                      <th className="py-3 pr-4 text-right font-medium">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c) => (
                      <tr key={c.id} onClick={() => setDrawer({ open: true, contact: c })} className={clsx("cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-surface-2/60", selected.has(c.id) && "bg-brand-soft/40")}>
                        <td className="py-2.5 pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox label={`Select ${c.name}`} checked={allMatching || selected.has(c.id)} onChange={() => toggle(c.id)} />
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={c.name} seed={c.id} size={34} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 truncate font-medium text-ink">
                                {c.name || <span className="text-ink-3">No name</span>}
                                {c.source === "inbound" && <Badge tone="gold" className="!px-1.5 !py-0 !text-[10px]">NEW</Badge>}
                              </div>
                              <div className="truncate text-[12px] text-ink-3">{c.company || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-3 text-ink-2">
                          <span title={countryName(c.country)}>{flag(c.country)}</span> {phone(c.phone)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex max-w-[260px] flex-wrap gap-1">
                            {c.tags.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}
                            {c.tags.length > 3 && <span className="text-[12px] text-ink-3">+{c.tags.length - 3}</span>}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3"><ContactStatus c={c} /></td>
                        <td className="whitespace-nowrap py-2.5 pr-4 text-right text-[12px] text-ink-3">{ago(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile list */}
                <label className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-4 py-2.5 text-[13px] font-medium text-ink-2 md:hidden">
                  <Checkbox label="Select all on this page" checked={pageAllSelected} indeterminate={!pageAllSelected && pageIds.some((id) => selected.has(id))} onChange={selectPage} />
                  {pageAllSelected ? `All ${num(pageIds.length)} on this page selected` : "Select all on this page"}
                </label>
                <ul className="divide-y divide-line md:hidden">
                  {items.map((c) => (
                    <li key={c.id} className={clsx("flex items-center gap-3 px-4 py-3", selected.has(c.id) && "bg-brand-soft/40")} onClick={() => setDrawer({ open: true, contact: c })}>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Checkbox label={`Select ${c.name}`} checked={allMatching || selected.has(c.id)} onChange={() => toggle(c.id)} />
                      </span>
                      <Avatar name={c.name} seed={c.id} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{c.name || phone(c.phone)}</div>
                        <div className="truncate text-[12px] text-ink-3">{flag(c.country)} {phone(c.phone)}{c.company && ` · ${c.company}`}</div>
                      </div>
                      <ContactStatus c={c} compact />
                    </li>
                  ))}
                </ul>
              </>
            )}

            {total > PAGE && (
              <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[13px] text-ink-3">
                <span>{num((page - 1) * PAGE + 1)}–{num(Math.min(page * PAGE, total))} of {num(total)}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="size-4" />}>Prev</Button>
                  <Button size="sm" variant="ghost" disabled={page * PAGE >= total} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="size-4" /></Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Bulk action bar */}
      {selCount > 0 && (
        <div className="animate-pop fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-2xl items-center gap-2 rounded-2xl border border-line bg-surface p-2 pl-4 shadow-pop lg:bottom-6 lg:left-[260px]">
          <span className="mr-auto whitespace-nowrap text-sm font-semibold">{num(selCount)} <span className="max-sm:hidden">selected</span></span>
          <Button size="sm" variant="primary" icon={<Megaphone className="size-4" />} onClick={campaignToSelected}>
            <span className="hidden sm:inline">Send campaign</span><span className="sm:hidden">Send</span>
          </Button>
          <Button size="sm" icon={<TagIcon className="size-4" />} onClick={() => setTagModal("addTags")} className="max-sm:!hidden">Add tag</Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="size-4" />}
            loading={bulk.isPending && bulk.variables?.action === "delete"}
            onClick={deleteSelected}
            className="!text-danger hover:!bg-danger-soft"
            aria-label={`Delete ${selCount} selected clients`}
          >
            <span className="hidden sm:inline">Delete</span>
          </Button>
          <Menu align="right" trigger={() => <Button size="sm" variant="ghost" aria-label="More actions"><MoreHorizontal className="size-4" /></Button>}>
            {(close) => (
              <>
                <MenuItem icon={<TagIcon />} onClick={() => { close(); setTagModal("addTags"); }}>Add tag</MenuItem>
                <MenuItem icon={<X />} onClick={() => { close(); setTagModal("removeTags"); }}>Remove tag</MenuItem>
                <MenuItem icon={<ShieldCheck />} onClick={() => { close(); verify.mutate(); }}>Check on WhatsApp</MenuItem>
                <MenuItem icon={<BellOff />} onClick={() => { close(); bulk.mutate({ action: "optOut" }); }}>Mark as opted out</MenuItem>
                <MenuItem icon={<Bell />} onClick={() => { close(); bulk.mutate({ action: "optIn" }); }}>Mark as opted in</MenuItem>
                <MenuItem icon={<Trash2 />} danger onClick={() => { close(); deleteSelected(); }}>Delete {num(selCount)} clients</MenuItem>
              </>
            )}
          </Menu>
          <button className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" onClick={() => { setSelected(new Set()); setAllMatching(false); }} aria-label="Clear selection">
            <X className="size-4" />
          </button>
        </div>
      )}

      <TagModal
        mode={tagModal}
        count={selCount}
        suggestions={meta?.tags.map((t) => t.tag) ?? []}
        onClose={() => setTagModal(null)}
        onApply={(t) => {
          bulk.mutate({ action: tagModal, tags: t });
          setTagModal(null);
        }}
      />
      <ClientDrawer open={drawer.open} contact={drawer.contact} onClose={() => setDrawer({ open: false, contact: null })} />
    </>
  );
}

/**
 * Progress of "Check on WhatsApp": one number every couple of seconds, so a
 * few hundred take a few minutes. Shown until dismissed after it finishes.
 */
function VerifyBanner() {
  const qc = useQueryClient();
  const [hidden, setHidden] = useState<number | null>(null);
  const { data } = useQuery({
    queryKey: ["verify"],
    queryFn: () => api<{ job: VerifyJob | null }>("/contacts/verify"),
    refetchInterval: (q) => (q.state.data?.job?.running ? 2000 : false),
  });
  const job = data?.job;
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && job && !job.running) {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["contacts-meta"] });
    }
    wasRunning.current = Boolean(job?.running);
  }, [job?.running, job, qc]);
  const cancel = useMutation({ mutationFn: () => post("/contacts/verify/cancel"), onSuccess: () => qc.invalidateQueries({ queryKey: ["verify"] }) });
  if (!job || (!job.running && hidden === job.startedAt) || (!job.running && Date.now() - (job.finishedAt ?? 0) > 10 * 60000)) return null;
  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {job.running ? <Loader2 className="size-4 animate-spin text-brand" /> : <ShieldCheck className="size-4 text-brand" />}
        <span className="font-medium">
          {job.running ? `Checking numbers on WhatsApp… ${num(job.done)} of ${num(job.total)}` : `Checked ${num(job.done)} numbers`}
        </span>
        <span className="text-ink-3">
          {num(job.valid)} on WhatsApp · <span className={job.invalid ? "text-danger" : ""}>{num(job.invalid)} not on WhatsApp</span>
          {job.skipped > 0 && ` · ${num(job.skipped)} checked recently, skipped`}
        </span>
        <span className="ml-auto">
          {job.running ? (
            <Button size="sm" variant="ghost" onClick={() => cancel.mutate()}>Stop</Button>
          ) : (
            <button className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" onClick={() => setHidden(job.startedAt)} aria-label="Hide"><X className="size-4" /></button>
          )}
        </span>
      </div>
      {job.running && <Progress value={pct(job.done, job.total)} className="mt-3" />}
      {job.lastError && <p className="mt-2 text-[12px] text-danger">{job.lastError}</p>}
    </Card>
  );
}

function ContactStatus({ c, compact }: { c: Contact; compact?: boolean }) {
  if (c.optedOut) return <Badge tone="warn">{compact ? "Opted out" : "Opted out"}</Badge>;
  if (c.waStatus === "invalid") return <Badge tone="danger">{compact ? "No WA" : "Not on WhatsApp"}</Badge>;
  if (compact) return null;
  return c.waStatus === "valid" ? <Badge tone="brand"><CheckCheck className="size-3" />On WhatsApp</Badge> : <Badge tone="brand" dot>Active</Badge>;
}

function TagModal({ mode, count, suggestions, onClose, onApply }: { mode: null | "addTags" | "removeTags"; count: number; suggestions: string[]; onClose: () => void; onApply: (t: string[]) => void }) {
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => setTags([]), [mode]);
  return (
    <Modal
      open={Boolean(mode)}
      onClose={onClose}
      size="sm"
      title={mode === "addTags" ? "Add tags" : "Remove tags"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!tags.length} onClick={() => onApply(tags)}>
            {mode === "addTags" ? "Add" : "Remove"} for {num(count)} clients
          </Button>
        </>
      }
    >
      <Label>Tags</Label>
      <TagInput value={tags} onChange={setTags} suggestions={suggestions} placeholder="Type a tag and press Enter" />
    </Modal>
  );
}
