import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCheck, MessagesSquare, Paperclip, Search, SendHorizontal, UserRound, Megaphone, Sparkles, FlaskConical, X, Loader2, BellOff } from "lucide-react";
import { api, post, uploadMedia, type ChatMessage, type Contact, type Conversation, type Media } from "../lib/api";
import { useDebounced, useStatus } from "../lib/hooks";
import { Avatar, Badge, Button, Empty, Loading, Segmented, Tag } from "../components/ui";
import { WaText } from "../components/PhonePreview";
import { ClientDrawer } from "../components/ClientDrawer";
import { chatTime, flag, phone, time } from "../lib/format";

type Filter = "all" | "unread" | "new";

export function InboxPage() {
  const { key } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: status } = useStatus();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [filter, setFilter] = useState<Filter>("all");

  const list = useQuery({
    queryKey: ["conversations", dq, filter],
    queryFn: () => api<{ items: Conversation[]; unread: number }>(`/conversations?q=${encodeURIComponent(dq)}&filter=${filter}`),
    refetchInterval: 4000,
  });

  const simulate = useMutation({
    mutationFn: () => post("/demo/incoming", {}),
    onSuccess: () => {
      toast.success("A new enquiry will arrive in a moment");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["conversations"] }), 800);
    },
  });

  const items = list.data?.items ?? [];

  return (
    /* Phones: pinned between the top bar and the tab bar, so only the messages
       scroll. Desktop: the full height beside the sidebar. */
    <div className="fixed inset-x-0 top-[57px] bottom-[calc(53px+max(env(safe-area-inset-bottom),6px))] z-10 flex bg-bg lg:static lg:-mx-10 lg:-my-9 lg:h-dvh">
      {/* Conversation list */}
      <section className={clsx("flex w-full shrink-0 flex-col border-r border-line bg-surface lg:w-[360px]", key && "hidden lg:flex")}>
        <div className="border-b border-line px-4 pb-3 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="font-display text-2xl font-medium tracking-tight">Inbox</h1>
            {status?.demo && (
              <Button size="sm" variant="ghost" icon={<FlaskConical className="size-4" />} onClick={() => simulate.mutate()} loading={simulate.isPending}>
                Simulate enquiry
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input className="field h-9 pl-9" placeholder="Search chats" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Segmented<Filter>
            className="mt-3 w-full [&>button]:flex-1 [&>button]:justify-center"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "unread", label: "Unread", count: list.data?.unread || undefined },
              { value: "new", label: "New enquiries" },
            ]}
          />
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto">
          {list.isLoading ? (
            <Loading />
          ) : items.length === 0 ? (
            <Empty icon={<MessagesSquare className="size-6" />} title={filter === "all" && !dq ? "No chats yet" : "Nothing here"}>
              {filter === "all" && !dq ? "When clients reply to a campaign or message you first, the chat appears here." : "Try another filter."}
            </Empty>
          ) : (
            items.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/inbox/${c.id}`)}
                className={clsx("flex w-full items-center gap-3 border-b border-line/60 px-4 py-3 text-left transition-colors", key === c.id ? "bg-brand-soft/60" : "hover:bg-surface-2")}
              >
                <Avatar name={c.name} seed={c.id} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={clsx("truncate text-sm", c.unread ? "font-semibold text-ink" : "font-medium text-ink")}>{c.name || phone(c.phone)}</span>
                    <span className={clsx("shrink-0 text-[11px]", c.unread ? "font-semibold text-brand-text" : "text-ink-3")}>{chatTime(c.lastAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {c.lastDir === "out" && <CheckCheck className="size-3.5 shrink-0 text-ink-3" />}
                    <span className={clsx("truncate text-[13px]", c.unread ? "text-ink-2" : "text-ink-3")}>{c.lastText}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      {c.isNew && <Badge tone="gold" className="!px-1.5 !py-0 !text-[10px]">NEW</Badge>}
                      {c.unread > 0 && <span className="flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">{c.unread}</span>}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Chat */}
      <section className={clsx("min-w-0 flex-1 flex-col", key ? "flex" : "hidden lg:flex")}>
        {key ? (
          <Chat key={key} convKey={key} onBack={() => navigate("/inbox")} />
        ) : (
          <div className="chat-wallpaper flex flex-1 items-center justify-center">
            <div className="max-w-xs rounded-2xl bg-surface/90 p-8 text-center shadow-card backdrop-blur">
              <MessagesSquare className="mx-auto size-8 text-ink-3" />
              <p className="mt-3 text-sm text-ink-2">Pick a chat to read and reply. New enquiries are saved as clients automatically.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function dayLabel(ms: number) {
  const d = new Date(ms);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function Chat({ convKey, onBack }: { convKey: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: status } = useStatus();
  const [text, setText] = useState("");
  const [media, setMedia] = useState<Media | null>(null);
  const [drawer, setDrawer] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastCount = useRef(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["chat", convKey],
    queryFn: () => api<{ key: string; conversation: Conversation | null; contact: Contact | null; messages: ChatMessage[] }>(`/conversations/${convKey}`),
    refetchInterval: 3000,
  });

  useEffect(() => {
    const n = data?.messages.length ?? 0;
    if (n !== lastCount.current) {
      // Scroll the message list only — never the page around it.
      const el = scroller.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: lastCount.current ? "smooth" : "auto" });
      lastCount.current = n;
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["status"] });
    }
  }, [data?.messages.length, qc]);

  const upload = useMutation({ mutationFn: uploadMedia, onSuccess: setMedia, onError: (e: Error) => toast.error(e.message) });

  const send = useMutation({
    mutationFn: () => post(`/conversations/${convKey}/send`, { text, mediaId: media?.id }),
    onSuccess: () => {
      setText("");
      setMedia(null);
      qc.invalidateQueries({ queryKey: ["chat", convKey] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Loading />;
  if (error || !data) return <p className="p-10 text-center text-sm text-ink-3">Chat not found.</p>;

  const c = data.contact;
  const name = c?.name || data.conversation?.name || phone(convKey);
  const connected = status?.wa.status === "connected";
  const canSend = (text.trim() || media) && connected && !send.isPending;

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2.5 sm:px-4">
        <button onClick={onBack} className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-2 lg:hidden" aria-label="Back to chats"><ArrowLeft className="size-5" /></button>
        <Avatar name={name} seed={convKey} size={38} />
        <button className="min-w-0 flex-1 text-left" onClick={() => c && setDrawer(true)}>
          <div className="flex items-center gap-2 truncate text-sm font-semibold">
            {name}
            {c?.source === "inbound" && <Badge tone="gold" className="!py-0"><Sparkles className="size-3" />Auto-added</Badge>}
            {c?.optedOut && <Badge tone="warn" className="!py-0"><BellOff className="size-3" />Opted out</Badge>}
          </div>
          <div className="truncate text-[12px] text-ink-3">
            {/^\d+$/.test(convKey) ? `${flag(c?.country)} ${phone(convKey)}` : "Hidden number"}
            {c?.company && ` · ${c.company}`}
          </div>
        </button>
        {c && (
          <div className="hidden items-center gap-1.5 xl:flex">
            {c.tags.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}
          </div>
        )}
        {c && <Button size="sm" variant="ghost" icon={<UserRound className="size-4" />} onClick={() => setDrawer(true)} className="hidden sm:inline-flex">Client</Button>}
      </header>

      <div ref={scroller} className="chat-wallpaper scroll-thin flex-1 overflow-y-auto px-3 py-4 sm:px-8">
        {data.messages.length === 0 && <p className="mt-10 text-center text-[13px] text-ink-3">No messages yet. Say hello!</p>}
        {data.messages.map((m, i) => {
          const prev = data.messages[i - 1];
          const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
          const out = m.dir === "out";
          return (
            <Fragment key={m.id}>
              {newDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-md bg-[var(--bubble-in)] px-2.5 py-1 text-[11px] font-medium text-ink-3 shadow-sm">{dayLabel(m.at)}</span>
                </div>
              )}
              <div className={clsx("mb-1.5 flex", out ? "justify-end" : "justify-start")}>
                <div className={clsx("relative max-w-[82%] rounded-lg px-2.5 pb-1.5 pt-1.5 text-[14px] leading-[1.4] shadow-sm sm:max-w-[65%]", out ? "rounded-tr-none bg-[var(--bubble-out)] text-[#111b21] dark:text-[#e9edef]" : "rounded-tl-none bg-[var(--bubble-in)] text-ink")}>
                  {m.campaignId && (
                    <Link to={`/campaigns/${m.campaignId}`} className="mb-1 flex items-center gap-1 text-[11px] font-medium opacity-60 hover:underline">
                      <Megaphone className="size-3" /> Campaign
                    </Link>
                  )}
                  {m.mediaType && <div className="mb-1 flex items-center gap-1.5 text-[12px] opacity-70"><Paperclip className="size-3.5" />{m.mediaType}</div>}
                  {m.text && <span className="whitespace-pre-wrap break-words"><WaText text={m.text} /></span>}
                  <span className="float-right ml-3 mt-1.5 flex translate-y-0.5 items-center gap-0.5 text-[10.5px] opacity-55">
                    {time(m.at).toLowerCase()}
                    {out && <Check className="size-3" />}
                  </span>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      <div className="border-t border-line bg-surface px-3 py-3 sm:px-4">
        {!connected && <p className="mb-2 text-center text-[12px] text-danger">WhatsApp is not connected — connect to reply.</p>}
        {c?.optedOut && <p className="mb-2 text-center text-[12px] text-warn">This client opted out of campaigns. You can still reply to them directly.</p>}
        {(media || upload.isPending) && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
            {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4 text-ink-3" />}
            <span className="flex-1 truncate">{upload.isPending ? "Uploading…" : media?.name}</span>
            {media && <button onClick={() => setMedia(null)} aria-label="Remove attachment" className="text-ink-3 hover:text-ink"><X className="size-4" /></button>}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button onClick={() => fileRef.current?.click()} className="mb-1 rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Attach file"><Paperclip className="size-5" /></button>
          <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) send.mutate();
              }
            }}
            rows={1}
            placeholder="Type a reply…"
            title="Enter to send · Shift+Enter for a new line"
            className="field max-h-40 min-h-11 flex-1 resize-none !rounded-2xl !py-2.5"
          />
          <button
            onClick={() => send.mutate()}
            disabled={!canSend}
            className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-hover disabled:opacity-40"
            aria-label="Send"
          >
            {send.isPending ? <Loader2 className="size-5 animate-spin" /> : <SendHorizontal className="size-5" />}
          </button>
        </div>
      </div>
      <ClientDrawer open={drawer} contact={c} onClose={() => { setDrawer(false); qc.invalidateQueries({ queryKey: ["chat", convKey] }); }} />
    </>
  );
}
