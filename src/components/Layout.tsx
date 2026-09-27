import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import clsx from "clsx";
import {
  ChevronsUpDown, FlaskConical, LogOut, Menu as MenuIcon, Moon, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Smartphone, Sun, WifiOff, X,
  Home, Megaphone, Users, MessagesSquare, Keyboard, Gauge,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStatus } from "../lib/hooks";
import { auth } from "../lib/api";
import { local } from "../lib/storage";
import { ALL_NAV, MOD_KEY, NAV_SECTIONS, SETTINGS_ITEM, type NavItem } from "../lib/nav";
import { num } from "../lib/format";
import { Menu, MenuItem, useBodyLock, useEscape } from "./ui";
import { CommandPalette, openCommand } from "./CommandPalette";

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  const toggle = () => {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    local.set("sl.theme", next ? "dark" : "light");
    setDark(next);
  };
  return { dark, toggle };
}

const typing = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return Boolean(t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)));
};

/**
 * Keyboard: "[" folds the sidebar, "g" then a letter jumps to a page
 * (g i → Inbox), "c" starts a broadcast. Never while typing.
 */
function useShortcuts(onToggle: () => void) {
  const navigate = useNavigate();
  const pendingG = useRef(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (Date.now() - pendingG.current < 1200) {
        pendingG.current = 0;
        const hit = ALL_NAV.find((n) => n.key === k);
        if (hit) {
          e.preventDefault();
          navigate(hit.to);
        }
        return;
      }
      if (k === "g") pendingG.current = Date.now();
      else if (e.key === "[") onToggle();
      else if (k === "c") navigate("/campaigns/new");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, onToggle]);
}

export function Layout() {
  const { data: status } = useStatus();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(() => local.get("sl.sidebar.collapsed", false));
  const [mobileNav, setMobileNav] = useState(false);

  const setFold = (v: boolean) => {
    setCollapsed(v);
    local.set("sl.sidebar.collapsed", v);
  };
  const fold = () => setFold(!collapsed);
  useShortcuts(fold);
  useEffect(() => setMobileNav(false), [location.pathname]);

  const signOut = () => {
    auth.clear();
    qc.clear();
    navigate("/login", { replace: true });
  };

  const onConnectPage = location.pathname === "/whatsapp";
  const disconnected = status && status.wa.status !== "connected" && !onConnectPage;

  return (
    <div className="min-h-dvh lg:flex">
      {/* ── Sidebar (desktop) ── */}
      <aside
        className={clsx(
          "sticky top-0 z-30 hidden h-dvh shrink-0 border-r border-line bg-surface transition-[width] duration-200 ease-out lg:block",
          collapsed ? "w-[68px]" : "w-[252px]",
        )}
      >
        <Sidebar collapsed={collapsed} onFold={fold} dark={dark} onTheme={toggle} onSignOut={signOut} />
      </aside>

      {/* ── Top bar (mobile) ── */}
      <header className="glass sticky top-0 z-30 flex items-center gap-2 border-b border-line px-3 py-2.5 lg:hidden">
        <button onClick={() => setMobileNav(true)} className="flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2" aria-label="Open menu">
          <MenuIcon className="size-5" />
        </button>
        <BrandMark />
        <span className="min-w-0 flex-1 truncate font-display text-[16px] font-bold tracking-tight">{status?.businessName || "Starlink Jewels"}</span>
        <button onClick={openCommand} className="flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2" aria-label="Search">
          <Search className="size-5" />
        </button>
        <WaDot />
      </header>

      {mobileNav && <MobileNav onClose={() => setMobileNav(false)} dark={dark} onTheme={toggle} onSignOut={signOut} />}

      <main className="min-w-0 flex-1 pb-24 lg:pb-0">
        {disconnected && (
          <Banner tone="danger" onClick={() => navigate("/whatsapp")}>
            <WifiOff className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <b>WhatsApp is not connected.</b> <span className="hidden sm:inline">Campaigns will wait and continue automatically once you connect.</span>
            </span>
            <span className="shrink-0 font-semibold underline underline-offset-2">Connect now</span>
          </Banner>
        )}
        {status?.dataError && (
          <Banner tone="warn">
            <span>
              <b>Data could not load:</b> {status.dataError}
            </span>
          </Banner>
        )}
        <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          <Outlet />
        </div>
      </main>

      <TabBar />
      <CommandPalette dark={dark} onToggleTheme={toggle} onSignOut={signOut} />
    </div>
  );
}

/* ══════ The sidebar ════════════════════════════════════════════════════ */

function Sidebar({ collapsed, onFold, dark, onTheme, onSignOut, onClose }: { collapsed: boolean; onFold?: () => void; dark: boolean; onTheme: () => void; onSignOut: () => void; onClose?: () => void }) {
  const { data: status } = useStatus();
  const navigate = useNavigate();
  const badge = (key?: NavItem["badge"]) => (key === "unread" ? status?.unread ?? 0 : key === "hot" ? status?.hotWaiting ?? 0 : 0);

  return (
    <div className={clsx("flex h-full flex-col", collapsed ? "px-3 py-3" : "px-3 py-3")}>
      {/* Workspace */}
      <div className={clsx("flex items-center gap-1", collapsed && "flex-col gap-2")}>
        <Menu
          align="left"
          className={clsx(!collapsed && "min-w-0 flex-1")}
          trigger={(open) => (
            <button className={clsx("flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-surface-2", open && "bg-surface-2")} aria-label="Workspace menu">
              <BrandMark />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[14px] font-semibold text-ink">{status?.businessName || "Starlink Jewels"}</span>
                    <span className="block truncate text-[11.5px] text-ink-3">WhatsApp Studio</span>
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 text-ink-3" />
                </>
              )}
            </button>
          )}
        >
          {(close) => (
            <div className="w-60">
              <div className="px-2.5 pb-2 pt-1.5">
                <div className="truncate text-[13px] font-semibold text-ink">{status?.businessName || "Starlink Jewels"}</div>
                <div className="truncate text-[12px] text-ink-3">{status?.wa.phoneDisplay ?? "WhatsApp not connected"}</div>
              </div>
              <div className="my-1 border-t border-line" />
              <MenuItem icon={<Smartphone />} onClick={() => { close(); onClose?.(); navigate("/whatsapp"); }}>WhatsApp connection</MenuItem>
              <MenuItem icon={<Settings />} onClick={() => { close(); onClose?.(); navigate("/settings"); }}>Settings</MenuItem>
              <MenuItem icon={dark ? <Sun /> : <Moon />} onClick={() => { close(); onTheme(); }}>{dark ? "Light mode" : "Dark mode"}</MenuItem>
              <MenuItem icon={<Keyboard />} onClick={() => { close(); openCommand(); }}>Search &amp; shortcuts <span className="ml-auto text-[11px] text-ink-3">{MOD_KEY} K</span></MenuItem>
              <div className="my-1 border-t border-line" />
              <MenuItem icon={<LogOut />} danger onClick={() => { close(); onSignOut(); }}>Sign out</MenuItem>
            </div>
          )}
        </Menu>
        {onFold && (
          <Tip label="Collapse sidebar" hint="[" show={false}>
            <button onClick={onFold} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={`${collapsed ? "Expand" : "Collapse"} sidebar  [`}>
              {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            </button>
          </Tip>
        )}
        {onClose && (
          <button onClick={onClose} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close menu">
            <X className="size-[18px]" />
          </button>
        )}
      </div>

      {/* Search + primary action */}
      <div className={clsx("mt-3 space-y-2", collapsed && "flex flex-col items-center")}>
        <Tip label="Search" hint={`${MOD_KEY} K`} show={collapsed}>
          <button
            onClick={openCommand}
            className={clsx(
              "flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 text-[13px] text-ink-3 transition-colors hover:border-ink-3/30 hover:text-ink-2",
              collapsed ? "size-10 justify-center" : "h-9 w-full px-2.5",
            )}
            aria-label="Search"
          >
            <Search className="size-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Search…</span>
                {!onClose && <kbd className="rounded border border-line bg-surface px-1.5 text-[10.5px] font-medium">{MOD_KEY} K</kbd>}
              </>
            )}
          </button>
        </Tip>
        <Tip label="New broadcast" hint="C" show={collapsed}>
          <button
            onClick={() => { onClose?.(); navigate("/campaigns/new"); }}
            className={clsx(
              "bg-brand-gradient flex items-center justify-center gap-2 rounded-lg text-[13px] font-semibold text-white shadow-sm shadow-violet-500/25 transition hover:brightness-110",
              collapsed ? "size-10" : "h-9 w-full",
            )}
            aria-label="New broadcast"
          >
            <Plus className="size-4" />
            {!collapsed && "New broadcast"}
          </button>
        </Tip>
      </div>

      {/* Navigation */}
      <nav className={clsx("mt-4 flex-1", collapsed ? "overflow-visible" : "scroll-thin -mx-1 overflow-y-auto px-1")} aria-label="Main">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i} className={clsx(i > 0 && "mt-5")}>
            {section.title && (collapsed ? <div className="mx-auto mb-2 h-px w-6 bg-line" /> : (
              <div className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{section.title}</div>
            ))}
            <ul className="space-y-0.5">
              {section.items.map((item) => <NavRow key={item.to} item={item} collapsed={collapsed} count={badge(item.badge)} onClick={onClose} />)}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-3 space-y-2 border-t border-line pt-3">
        {!collapsed && <UsageCard onClick={onClose} />}
        {status?.demo && (
          <Tip label="Demo mode — nothing is really sent" show={collapsed}>
            <div className={clsx("flex items-center gap-2 rounded-lg bg-fuchsia-500/10 text-[12px] font-medium text-fuchsia-700 dark:text-fuchsia-300", collapsed ? "mx-auto size-10 justify-center" : "px-2.5 py-1.5")}>
              <FlaskConical className="size-4 shrink-0" /> {!collapsed && "Demo mode · nothing is sent"}
            </div>
          </Tip>
        )}
        <ul className="space-y-0.5">
          <NavRow item={SETTINGS_ITEM} collapsed={collapsed} count={0} onClick={onClose} />
        </ul>
        <WaRow collapsed={collapsed} onClick={onClose} />
      </div>
    </div>
  );
}

function NavRow({ item, collapsed, count, onClick }: { item: NavItem; collapsed: boolean; count: number; onClick?: () => void }) {
  const Icon = item.icon;
  const hot = item.badge === "hot";
  return (
    <li>
      <Tip label={item.label} hint={`G ${item.key.toUpperCase()}`} show={collapsed}>
        <NavLink
          to={item.to}
          end={item.end}
          onClick={onClick}
          className={({ isActive }) =>
            clsx(
              "group relative flex items-center rounded-lg text-[13.5px] font-medium transition-colors",
              collapsed ? "mx-auto size-10 justify-center" : "h-9 gap-2.5 px-2.5",
              isActive ? "bg-brand-soft text-brand-text" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={clsx("size-[18px] shrink-0", isActive ? "text-brand" : "text-ink-3 group-hover:text-ink-2")} strokeWidth={isActive ? 2.2 : 1.9} />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {count > 0 && (collapsed ? (
                <span className={clsx("absolute right-1 top-1 size-2 rounded-full ring-2 ring-surface", hot ? "bg-rose-500" : "bg-brand")} />
              ) : (
                <span className={clsx("min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5", hot ? "bg-rose-500/12 text-rose-600 dark:text-rose-300" : isActive ? "bg-brand text-white" : "bg-surface-3 text-ink-2")}>
                  {count > 99 ? "99+" : count}
                </span>
              ))}
            </>
          )}
        </NavLink>
      </Tip>
    </li>
  );
}

/** Today's sending against the daily limit — the number a sender watches all day. */
function UsageCard({ onClick }: { onClick?: () => void }) {
  const { data: s } = useStatus();
  const navigate = useNavigate();
  if (!s?.dailyLimit) return null;
  const used = Math.min(100, Math.round((s.sentToday / s.dailyLimit) * 100));
  return (
    <button onClick={() => { onClick?.(); navigate("/settings#safety"); }} className="w-full rounded-xl border border-line bg-surface-2/50 p-3 text-left transition-colors hover:bg-surface-2">
      <div className="flex items-center justify-between text-[12px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-ink-2"><Gauge className="size-3.5 text-ink-3" /> Sent today</span>
        <span className="font-semibold text-ink">{num(s.sentToday)} <span className="font-normal text-ink-3">/ {num(s.dailyLimit)}</span></span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className={clsx("h-full rounded-full transition-[width] duration-500", used >= 90 ? "bg-amber-500" : "bg-brand-gradient")} style={{ width: `${used}%` }} />
      </div>
      {s.warmupDay ? <p className="mt-1.5 text-[11px] text-ink-3">Warm-up day {s.warmupDay}</p> : null}
    </button>
  );
}

function WaRow({ collapsed, onClick }: { collapsed: boolean; onClick?: () => void }) {
  const { data } = useStatus();
  const navigate = useNavigate();
  const connected = data?.wa.status === "connected";
  const label = connected ? "WhatsApp connected" : data?.wa.status === "qr" ? "Scan QR to connect" : "WhatsApp offline";
  return (
    <Tip label={label} hint={connected ? data?.wa.phoneDisplay ?? undefined : undefined} show={collapsed}>
      <button
        onClick={() => { onClick?.(); navigate("/whatsapp"); }}
        className={clsx("flex items-center rounded-lg transition-colors hover:bg-surface-2", collapsed ? "mx-auto size-10 justify-center" : "w-full gap-2.5 px-2.5 py-2 text-left")}
        aria-label={label}
      >
        <span className="relative flex size-[18px] shrink-0 items-center justify-center">
          <Smartphone className={clsx("size-[18px]", connected ? "text-ink-3" : "text-danger")} />
          <span className={clsx("absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-surface", connected ? "bg-emerald-500" : "animate-pulse-dot bg-danger")} />
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1 leading-tight">
            <span className={clsx("block truncate text-[13px] font-medium", connected ? "text-ink" : "text-danger")}>{label}</span>
            <span className="block truncate text-[11.5px] text-ink-3">{connected ? data?.wa.phoneDisplay : "Tap to connect your number"}</span>
          </span>
        )}
      </button>
    </Tip>
  );
}

/** A label beside an icon when the sidebar is folded — the icon alone is not enough. */
function Tip({ label, hint, show, children }: { label: string; hint?: string; show: boolean; children: ReactNode }) {
  if (!show) return <>{children}</>;
  return (
    <div className="group/tip relative">
      {children}
      <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-medium text-surface opacity-0 shadow-pop transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100">
        {label}
        {hint && <span className="text-[11px] opacity-60">{hint}</span>}
      </span>
    </div>
  );
}

function BrandMark() {
  return (
    <span className="bg-brand-gradient flex size-8 shrink-0 items-center justify-center rounded-[10px] text-white shadow-sm shadow-violet-500/30">
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeLinejoin="round" aria-hidden>
        <path d="M5 9.5 8.2 5h7.6L19 9.5 12 20z" strokeWidth="1.8" />
        <path d="M5 9.5h14M9.8 9.5 12 20l2.2-10.5M8.2 5l1.6 4.5L12 5l2.2 4.5L15.8 5" strokeWidth="1.1" opacity=".75" />
      </svg>
    </span>
  );
}

/* ══════ Phones ═════════════════════════════════════════════════════════ */

function MobileNav({ onClose, dark, onTheme, onSignOut }: { onClose: () => void; dark: boolean; onTheme: () => void; onSignOut: () => void }) {
  useEscape(onClose);
  useBodyLock(true);
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="animate-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-slide-left absolute inset-y-0 left-0 w-[84%] max-w-[300px] border-r border-line bg-surface shadow-pop" role="dialog" aria-modal="true" aria-label="Menu">
        <Sidebar collapsed={false} dark={dark} onTheme={onTheme} onSignOut={onSignOut} onClose={onClose} />
      </div>
    </div>
  );
}

function WaDot() {
  const { data } = useStatus();
  const navigate = useNavigate();
  const connected = data?.wa.status === "connected";
  return (
    <button onClick={() => navigate("/whatsapp")} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-medium" aria-label="WhatsApp connection">
      <span className={clsx("size-2 rounded-full", connected ? "bg-emerald-500" : "animate-pulse-dot bg-danger")} />
      {connected ? "Live" : "Offline"}
    </button>
  );
}

function TabBar() {
  const { data: status } = useStatus();
  const navigate = useNavigate();
  const tabs = [
    { to: "/", label: "Home", icon: Home, end: true, n: 0 },
    { to: "/campaigns", label: "Broadcasts", icon: Megaphone, n: 0 },
    null,
    { to: "/clients", label: "Clients", icon: Users, n: 0 },
    { to: "/inbox", label: "Inbox", icon: MessagesSquare, n: status?.unread ?? 0 },
  ];
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 lg:hidden" aria-label="Quick">
      {tabs.map((t) => {
        if (!t) {
          return (
            <button key="fab" onClick={() => navigate("/campaigns/new")} className="flex flex-col items-center gap-0.5" aria-label="New broadcast">
              <span className="bg-brand-gradient glow-brand -mt-5 flex size-12 items-center justify-center rounded-2xl text-white">
                <Plus className="size-6" />
              </span>
            </button>
          );
        }
        const Icon = t.icon;
        return (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => clsx("relative flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium", isActive ? "text-brand-text" : "text-ink-3")}>
            <Icon className="size-5" />
            {t.label}
            {t.n > 0 && <span className="absolute right-[22%] top-0 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-1 text-[10px] font-semibold text-white">{t.n}</span>}
          </NavLink>
        );
      })}
    </nav>
  );
}

function Banner({ tone, children, onClick }: { tone: "danger" | "warn"; children: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] sm:px-6 lg:px-10",
        tone === "danger" ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn",
      )}
    >
      {children}
    </Tag>
  );
}
