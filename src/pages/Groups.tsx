import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { RefreshCw, Search, Send, Users, UsersRound, Megaphone, Crown, Lock, X, Download, UserPlus, Paperclip, Loader2, Info, Tag as TagIcon } from "lucide-react";
import { api, post, put, uploadMedia, type Group, type GroupDetail, type Media } from "../lib/api";
import { useDebounced } from "../lib/hooks";
import { Avatar, Badge, Button, Callout, Card, Checkbox, Drawer, Empty, Label, Loading, Modal, PageHeader, Segmented, Tag } from "../components/ui";
import { TagInput } from "../components/TagInput";
import { ago, num, phone } from "../lib/format";
import { exportRows } from "../lib/excel";

type ListRes = { items: Group[]; tags: { tag: string; count: number }[]; syncedAt: number | null; syncError: string | null; connected: boolean };

/**
 * The WhatsApp groups this number is in. WhatsApp keeps the groups; the app
 * adds tags so a broadcast can go to "all Buyers groups" in one go.
 */
export function GroupsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [tag, setTag] = useState("");
  const [show, setShow] = useState<"active" | "left">("active");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [sendTo, setSendTo] = useState<Group | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["groups", dq, tag, show],
    queryFn: () => api<ListRes>(`/groups?q=${encodeURIComponent(dq)}&tag=${encodeURIComponent(tag)}&show=${show}`),
  });

  const sync = useMutation({
    mutationFn: () => post<{ count: number; left: number }>("/groups/sync"),
    onSuccess: (r) => {
      toast.success(`${num(r.count)} groups up to date${r.left ? ` · ${r.left} you left` : ""}`);
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = data?.items ?? [];
  const postable = items.filter((g) => g.canSend);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <>
      <PageHeader
        title="Groups"
        subtitle="The WhatsApp groups your number is in. Tag them, see members, and broadcast to many groups at once."
        actions={
          <>
            <Button icon={<RefreshCw className={clsx("size-4", (sync.isPending || isFetching) && "animate-spin")} />} onClick={() => sync.mutate()} disabled={sync.isPending || data?.connected === false}>
              Sync from WhatsApp
            </Button>
            <Button variant="primary" icon={<Megaphone className="size-4" />} onClick={() => navigate("/campaigns/new", { state: { groups: true } })}>
              Broadcast to groups
            </Button>
          </>
        }
      />

      {data?.syncError && <Callout tone="warn" icon={<Info />} className="mb-4">Could not refresh from WhatsApp: {data.syncError}. Showing the last saved list.</Callout>}

      {isLoading ? (
        <Loading />
      ) : !items.length && !dq && !tag && show === "active" ? (
        <Card>
          <Empty icon={<UsersRound className="size-6" />} title={data?.connected ? "No groups found" : "Connect WhatsApp to see your groups"}
            action={data?.connected ? <Button onClick={() => sync.mutate()} loading={sync.isPending}>Sync again</Button> : <Button variant="primary" onClick={() => navigate("/whatsapp")}>Connect WhatsApp</Button>}>
            {data?.connected ? "This number is not in any WhatsApp group yet." : "Groups are read from your WhatsApp once it is connected."}
          </Empty>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input className="field h-10 pl-9" placeholder="Search groups" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Segmented value={show} onChange={(v) => { setShow(v); setSelected(new Set()); }} options={[{ value: "active", label: "My groups" }, { value: "left", label: "Left" }]} />
          </div>

          {(data?.tags.length ?? 0) > 0 && (
            <div className="scroll-thin -mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
              <TagIcon className="size-4 shrink-0 text-ink-3" />
              {data!.tags.map((t) => (
                <button key={t.tag} onClick={() => setTag(tag === t.tag ? "" : t.tag)} className={clsx("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium", tag === t.tag ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong")}>
                  {t.tag} <span className={tag === t.tag ? "text-white/75" : "text-ink-3"}>{t.count}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mb-3 flex items-center justify-between text-[12px] text-ink-3">
            <span>{num(items.length)} groups · {num(postable.length)} you can post in{data?.syncedAt ? ` · synced ${ago(data.syncedAt)}` : ""}</span>
            {show === "active" && postable.length > 0 && (
              <button className="font-medium text-brand-text hover:underline" onClick={() => setSelected(selected.size === postable.length ? new Set() : new Set(postable.map((g) => g.id)))}>
                {selected.size === postable.length ? "Clear selection" : "Select all I can post in"}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-3">No groups here.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((g) => (
                <Card key={g.id} className={clsx("flex flex-col p-4 transition-colors", selected.has(g.id) && "border-brand ring-1 ring-brand")}>
                  <div className="flex items-start gap-3">
                    {g.canSend && !g.left && (
                      <span className="pt-2"><Checkbox label={`Select ${g.name}`} checked={selected.has(g.id)} onChange={() => toggle(g.id)} /></span>
                    )}
                    <Avatar name={g.name} seed={g.id} size={40} />
                    <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(g.id)}>
                      <div className="line-clamp-2 text-sm font-semibold text-ink">{g.name}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-3"><Users className="size-3.5" /> {num(g.size)} members</div>
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {g.left ? <Badge tone="neutral">You left</Badge> : g.canSend ? <Badge tone="brand" dot>You can post</Badge> : <Badge tone="warn"><Lock className="size-3" />Only admins post</Badge>}
                    {g.iAmAdmin && <Badge tone="gold"><Crown className="size-3" />Admin</Badge>}
                    {g.isCommunity && <Badge tone="info">Community</Badge>}
                    {g.tags.map((t) => <Tag key={t}>{t}</Tag>)}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                    <span className="text-[12px] text-ink-3">{g.lastPostAt ? `Posted ${ago(g.lastPostAt)}` : "Not posted yet"}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(g.id)}>Members</Button>
                      <Button size="sm" variant="soft" icon={<Send className="size-3.5" />} disabled={!g.canSend || g.left} onClick={() => setSendTo(g)}>Send</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {selected.size > 0 && (
        <div className="animate-pop fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-line bg-surface p-2 pl-4 shadow-pop lg:bottom-6 lg:left-[260px]">
          <span className="mr-auto whitespace-nowrap text-sm font-semibold">{num(selected.size)} <span className="max-sm:hidden">groups selected</span></span>
          <Button size="sm" variant="primary" icon={<Megaphone className="size-4" />} onClick={() => navigate("/campaigns/new", { state: { groupIds: [...selected] } })}>
            Broadcast to {num(selected.size)}
          </Button>
          <button className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" onClick={() => setSelected(new Set())} aria-label="Clear selection"><X className="size-4" /></button>
        </div>
      )}

      <GroupDrawer id={openId} onClose={() => setOpenId(null)} tagSuggestions={data?.tags.map((t) => t.tag) ?? []} />
      <SendToGroup group={sendTo} onClose={() => setSendTo(null)} />
    </>
  );
}

function GroupDrawer({ id, onClose, tagSuggestions }: { id: string | null; onClose: () => void; tagSuggestions: string[] }) {
  const qc = useQueryClient();
  const { data: g, isLoading } = useQuery({ queryKey: ["group", id], queryFn: () => api<GroupDetail>(`/groups/${id}`), enabled: Boolean(id) });
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [importTags, setImportTags] = useState<string[]>([]);
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (g && loadedFor.current !== g.id) {
      loadedFor.current = g.id;
      setTags(g.tags);
      setNote(g.note ?? "");
      setImportTags([g.name.slice(0, 40)]);
    }
    if (!id) loadedFor.current = null;
  }, [g, id]);

  const save = useMutation({
    mutationFn: () => put(`/groups/${id}`, { tags, note }),
    onSuccess: () => { toast.success("Group saved"); qc.invalidateQueries({ queryKey: ["groups"] }); qc.invalidateQueries({ queryKey: ["group", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const importM = useMutation({
    mutationFn: () => post<{ added: number; updated: number; hidden: number }>(`/groups/${id}/import`, { tags: importTags }),
    onSuccess: (r) => {
      toast.success(`${num(r.added)} new clients added${r.updated ? `, ${num(r.updated)} tagged` : ""}${r.hidden ? ` · ${num(r.hidden)} hide their number` : ""}`);
      qc.invalidateQueries({ queryKey: ["group", id] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["contacts-meta"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const members = g?.members ?? [];
  const withPhone = members.filter((m) => m.phone);
  const notClients = withPhone.filter((m) => !m.isClient).length;

  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      title={g?.name ?? "Group"}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}
    >
      {isLoading || !g ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1.5">
            {g.canSend ? <Badge tone="brand" dot>You can post</Badge> : <Badge tone="warn"><Lock className="size-3" />Only admins post</Badge>}
            {g.iAmAdmin && <Badge tone="gold"><Crown className="size-3" />You are admin</Badge>}
            <Badge tone="neutral"><Users className="size-3" />{num(g.size)} members</Badge>
          </div>
          {g.description && <p className="whitespace-pre-wrap rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-ink-2">{g.description}</p>}
          <div>
            <Label hint="Broadcast to all groups with a tag">Tags</Label>
            <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} placeholder="e.g. Buyers, Dubai" />
          </div>
          <div>
            <Label htmlFor="g-note" hint="Only you see this">Note</Label>
            <textarea id="g-note" rows={2} className="field resize-y" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who is in it, posting rules…" />
          </div>

          <div className="rounded-xl border border-line p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><UserPlus className="size-4 text-brand" /> Save members as clients</div>
            <p className="mt-1 text-[13px] text-ink-3">
              {num(notClients)} of {num(withPhone.length)} members are not in your clients yet.
              {members.length > withPhone.length && ` ${num(members.length - withPhone.length)} hide their number and cannot be saved.`}
            </p>
            <div className="mt-3">
              <TagInput value={importTags} onChange={setImportTags} placeholder="Tag them as…" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" disabled={!withPhone.length} loading={importM.isPending} onClick={() => importM.mutate()}>Save {num(notClients)} as clients</Button>
              <Button size="sm" icon={<Download className="size-4" />} disabled={!members.length} onClick={() => exportRows(members.map((m) => ({ "WhatsApp Number": m.phone ? "+" + m.phone : "(hidden)", "Client name": m.clientName ?? "", Admin: m.admin ? "Yes" : "" })), `${g.name.replace(/[^\w -]+/g, "").slice(0, 40) || "group"}-members.xlsx`, "Members")}>
                Export to Excel
              </Button>
            </div>
            <p className="mt-2 text-[12px] text-ink-3">Only message members who would welcome it — unwanted messages get numbers reported.</p>
          </div>

          <div>
            <Label>Members</Label>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {members.slice(0, 300).map((m, i) => (
                <li key={m.phone ?? `hidden-${i}`} className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={m.clientName ?? ""} seed={m.phone ?? String(i)} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{m.clientName || (m.phone ? phone(m.phone) : "Hidden number")}</div>
                    {m.clientName && m.phone && <div className="text-[12px] text-ink-3">{phone(m.phone)}</div>}
                  </div>
                  {m.admin && <Badge tone="gold">Admin</Badge>}
                  {m.isClient && <Badge tone="brand">Client</Badge>}
                </li>
              ))}
              {members.length > 300 && <li className="px-3 py-2 text-[12px] text-ink-3">…and {num(members.length - 300)} more (all included in the export)</li>}
            </ul>
          </div>
        </div>
      )}
    </Drawer>
  );
}

/** One message into one group, right now. */
function SendToGroup({ group, onClose }: { group: Group | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [media, setMedia] = useState<Media | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (group) { setText(""); setMedia(null); }
  }, [group]);
  const upload = useMutation({ mutationFn: uploadMedia, onSuccess: setMedia, onError: (e: Error) => toast.error(e.message) });
  const send = useMutation({
    mutationFn: () => post(`/groups/${group!.id}/send`, { text, mediaId: media?.id }),
    onSuccess: () => { toast.success(`Posted in ${group!.name}`); qc.invalidateQueries({ queryKey: ["groups"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      open={Boolean(group)}
      onClose={onClose}
      title={group ? `Send to “${group.name}”` : ""}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" icon={<Send className="size-4" />} loading={send.isPending} disabled={!text.trim() && !media} onClick={() => send.mutate()}>Send now</Button></>}
    >
      <textarea autoFocus rows={6} className="field resize-y" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Good morning {{group_name}} 💎\n\nNew certified solitaires just arrived…"} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setText((t) => t + "{{group_name}}")} className="rounded-full border border-brand/25 bg-brand-soft px-2.5 py-1 text-[12px] font-medium text-brand-text">+ Group name</button>
        <Button size="sm" variant="ghost" icon={upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />} onClick={() => file.current?.click()}>
          {media ? media.name : "Attach photo, video or PDF"}
        </Button>
        {media && <button onClick={() => setMedia(null)} className="text-ink-3 hover:text-ink" aria-label="Remove attachment"><X className="size-4" /></button>}
        <input ref={file} type="file" hidden accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
      </div>
      <p className="mt-3 text-[12px] text-ink-3">For many groups at once, with safe gaps and scheduling, use “Broadcast to groups”.</p>
    </Modal>
  );
}
