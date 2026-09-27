import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ArrowRight, CornerDownLeft, FileSpreadsheet, Layers, LogOut, Megaphone, Moon, Plus, QrCode, Search, Smartphone, Sun, UserPlus,
} from "lucide-react";
import { api, type Batch, type Campaign, type Contact } from "../lib/api";
import { ALL_NAV } from "../lib/nav";
import { useDebounced } from "../lib/hooks";
import { flag, phone as fmtPhone } from "../lib/format";
import { Avatar, useBodyLock } from "./ui";

export const COMMAND_EVENT = "sl:command";
export const openCommand = () => window.dispatchEvent(new Event(COMMAND_EVENT));

type Cmd = { id: string; group: string; label: string; sub?: string; icon: ReactNode; words?: string; hint?: string; run: () => void };

/**
 * ⌘K / Ctrl+K: jump to any page, start any task, or find a client, broadcast
 * or batch by typing — without reaching for the mouse.
 */
export function CommandPalette({ dark, onToggleTheme, onSignOut }: { dark: boolean; onToggleTheme: () => void; onSignOut: () => void }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const dq = useDebounced(q.trim(), 180);
  useBodyLock(open);

  useEffect(() => {
    const show = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener(COMMAND_EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(COMMAND_EVENT, show);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  const clients = useQuery({
    queryKey: ["cmd-clients", dq],
    queryFn: () => api<{ items: Contact[] }>(`/contacts?q=${encodeURIComponent(dq)}&pageSize=6`),
    enabled: open && dq.length >= 2,
    staleTime: 10000,
  });
  const campaigns = useQuery({ queryKey: ["campaigns", "cmd"], queryFn: () => api<{ items: Campaign[] }>("/campaigns"), enabled: open, staleTime: 30000 });
  const batches = useQuery({ queryKey: ["batches", "cmd"], queryFn: () => api<{ items: Batch[] }>("/batches"), enabled: open, staleTime: 30000 });

  const go = (to: string, state?: unknown) => () => navigate(to, state ? { state } : undefined);

  const items = useMemo(() => {
    const base: Cmd[] = [
      { id: "new-broadcast", group: "Create", label: "New broadcast", icon: <Megaphone />, words: "campaign send message", run: go("/campaigns/new") },
      { id: "add-client", group: "Create", label: "Add a client", icon: <UserPlus />, words: "contact number person", run: go("/clients", { create: true }) },
      { id: "import", group: "Create", label: "Import clients from Excel", icon: <FileSpreadsheet />, words: "upload xlsx csv spreadsheet", run: go("/clients/import") },
      { id: "new-batch", group: "Create", label: "New batch", icon: <Layers />, words: "list segment", run: go("/batches", { create: true }) },
      { id: "new-link", group: "Create", label: "New lead link / QR code", icon: <QrCode />, words: "trade show booth card website instagram", run: go("/leads?tab=links", { create: true }) },
      ...ALL_NAV.map((n) => ({ id: `nav-${n.to}`, group: "Go to", label: n.label, icon: <n.icon />, words: n.words, hint: `G ${n.key.toUpperCase()}`, run: go(n.to) })),
      { id: "connect", group: "Go to", label: "WhatsApp connection", icon: <Smartphone />, words: "qr scan link device phone number", run: go("/whatsapp") },
      { id: "theme", group: "Preferences", label: dark ? "Switch to light mode" : "Switch to dark mode", icon: dark ? <Sun /> : <Moon />, words: "theme appearance colour", run: onToggleTheme },
      { id: "signout", group: "Preferences", label: "Sign out", icon: <LogOut />, words: "logout exit", run: onSignOut },
    ];
    const needle = dq.toLowerCase();
    const match = (c: Cmd) => !needle || `${c.label} ${c.words ?? ""} ${c.sub ?? ""}`.toLowerCase().includes(needle);
    const found: Cmd[] = base.filter(match);
    if (needle) {
      for (const c of clients.data?.items ?? []) {
        found.push({ id: `client-${c.id}`, group: "Clients", label: c.name || fmtPhone(c.phone), sub: [c.company, `${flag(c.country)} ${fmtPhone(c.phone)}`].filter(Boolean).join(" · "), icon: <Avatar name={c.name} seed={c.id} size={22} />, run: go("/clients", { openClient: c.id }) });
      }
      for (const c of (campaigns.data?.items ?? []).filter((x) => x.name.toLowerCase().includes(needle)).slice(0, 4)) {
        found.push({ id: `camp-${c.id}`, group: "Broadcasts", label: c.name || "Untitled broadcast", sub: c.status, icon: <Megaphone />, run: go(`/campaigns/${c.id}`) });
      }
      for (const b of (batches.data?.items ?? []).filter((x) => x.name.toLowerCase().includes(needle)).slice(0, 4)) {
        found.push({ id: `batch-${b.id}`, group: "Batches", label: b.name, sub: `${b.members} clients`, icon: <Layers />, run: go(`/batches/${b.id}`) });
      }
    }
    return found;
  }, [dq, dark, clients.data, campaigns.data, batches.data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setActive(0), [dq]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;
  const close = () => setOpen(false);
  const run = (c?: Cmd) => {
    if (!c) return;
    close();
    c.run();
  };

  let i = -1;
  const groups = [...new Set(items.map((c) => c.group))];

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search and commands">
      <div className="animate-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={close} />
      <div className="animate-pop relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-[18px] shrink-0 text-ink-3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); run(items[active]); }
              else if (e.key === "Escape") { e.preventDefault(); close(); }
            }}
            placeholder="Search clients, broadcasts, pages… or type a command"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
            aria-label="Search"
          />
          <kbd className="hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-3 sm:block">Esc</kbd>
        </div>
        <div ref={list} className="scroll-thin max-h-[min(60vh,440px)] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-ink-3">{clients.isFetching ? "Searching…" : `Nothing matches “${q}”`}</p>
          ) : (
            groups.map((g) => (
              <div key={g} className="mb-1">
                <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{g}</div>
                {items.filter((c) => c.group === g).map((c) => {
                  i += 1;
                  const idx = i;
                  return (
                    <button
                      key={c.id}
                      data-i={idx}
                      onMouseMove={() => setActive(idx)}
                      onClick={() => run(c)}
                      className={clsx("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px]", idx === active ? "bg-surface-2 text-ink" : "text-ink-2")}
                    >
                      <span className={clsx("flex size-6 shrink-0 items-center justify-center [&>svg]:size-[17px]", idx === active ? "text-brand-text" : "text-ink-3")}>{c.icon}</span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{c.label}</span>
                        {c.sub && <span className="ml-2 text-[12px] text-ink-3">{c.sub}</span>}
                      </span>
                      {c.hint && <span className="shrink-0 text-[11px] font-medium tracking-wider text-ink-3">{c.hint}</span>}
                      {idx === active && <ArrowRight className="size-4 shrink-0 text-ink-3" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-line bg-surface-2/60 px-4 py-2 text-[11.5px] text-ink-3">
          <span className="inline-flex items-center gap-1"><kbd className="rounded border border-line bg-surface px-1">↑</kbd><kbd className="rounded border border-line bg-surface px-1">↓</kbd> move</span>
          <span className="inline-flex items-center gap-1"><CornerDownLeft className="size-3.5" /> open</span>
          <span className="ml-auto hidden items-center gap-1 sm:inline-flex"><Plus className="size-3.5" /> Tip: press <b className="font-semibold text-ink-2">G</b> then a letter to jump — G I for Inbox</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
