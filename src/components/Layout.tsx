import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import clsx from "clsx";
import { Home, Megaphone, Users, MessagesSquare, FileText, Settings, Plus, Moon, Sun, LogOut, Smartphone, WifiOff, FlaskConical, MoreHorizontal } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStatus } from "../lib/hooks";
import { auth } from "../lib/api";
import { local } from "../lib/storage";
import { Button, Menu, MenuItem } from "./ui";
import { Logo } from "./Logo";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/inbox", label: "Inbox", icon: MessagesSquare, badge: "unread" as const },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
];

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

function WaPill({ compact }: { compact?: boolean }) {
  const { data } = useStatus();
  const navigate = useNavigate();
  const s = data?.wa.status;
  const connected = s === "connected";
  if (compact) {
    return (
      <button onClick={() => navigate("/whatsapp")} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-medium" aria-label="WhatsApp connection">
        <span className={clsx("size-2 rounded-full", connected ? "bg-brand" : "animate-pulse-dot bg-danger")} />
        {connected ? "Live" : "Offline"}
      </button>
    );
  }
  return (
    <button
      onClick={() => navigate("/whatsapp")}
      className={clsx(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
        connected ? "border-line bg-surface hover:bg-surface-2" : "border-danger/25 bg-danger-soft hover:brightness-[0.98]",
      )}
    >
      <span className={clsx("flex size-8 shrink-0 items-center justify-center rounded-lg", connected ? "bg-brand-soft text-brand-text" : "bg-surface text-danger")}>
        {connected ? <Smartphone className="size-4" /> : <WifiOff className="size-4" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <span className={clsx("size-1.5 rounded-full", connected ? "bg-brand" : "animate-pulse-dot bg-danger")} />
          {connected ? "WhatsApp connected" : s === "qr" ? "Scan QR to connect" : "Not connected"}
        </span>
        <span className="block truncate text-[12px] text-ink-3">{connected ? data?.wa.phoneDisplay : "Tap to connect your number"}</span>
      </span>
    </button>
  );
}

export function Layout() {
  const { data: status } = useStatus();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const signOut = () => {
    auth.clear();
    qc.clear();
    navigate("/login", { replace: true });
  };

  const badge = (key?: "unread") => (key === "unread" && status?.unread ? status.unread : 0);
  const onConnectPage = location.pathname === "/whatsapp";
  const disconnected = status && status.wa.status !== "connected" && !onConnectPage;

  return (
    <div className="min-h-dvh lg:flex">
      {/* ── Sidebar (desktop) ── */}
      <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col border-r border-line bg-surface/60 px-4 py-5 backdrop-blur lg:flex">
        <div className="px-2">
          <Logo name={status?.businessName} />
        </div>
        <Button variant="primary" className="mt-6 w-full" icon={<Plus className="size-4" />} onClick={() => navigate("/campaigns/new")}>
          New campaign
        </Button>
        <nav className="mt-5 flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon, end, badge: b }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  "group flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/70 hover:text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={clsx("size-[18px]", isActive ? "text-brand" : "text-ink-3 group-hover:text-ink-2")} />
                  <span className="flex-1">{label}</span>
                  {badge(b) > 0 && <span className="rounded-full bg-brand px-1.5 py-px text-[11px] font-semibold text-white">{badge(b)}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          {status?.demo && (
            <div className="flex items-center gap-2 rounded-xl bg-gold-soft px-3 py-2 text-[12px] font-medium text-gold">
              <FlaskConical className="size-4" /> Demo mode — nothing is really sent
            </div>
          )}
          <WaPill />
          <div className="flex items-center justify-between px-1">
            <button onClick={toggle} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink">
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />} {dark ? "Light" : "Dark"} mode
            </button>
            <button onClick={signOut} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink">
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Top bar (mobile) ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-3 backdrop-blur lg:hidden">
        <Logo name={status?.businessName} compact />
        <div className="flex items-center gap-2">
          <WaPill compact />
          <Menu
            trigger={() => (
              <button className="flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2" aria-label="More">
                <MoreHorizontal className="size-5" />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem icon={<FileText />} onClick={() => { close(); navigate("/templates"); }}>Templates</MenuItem>
                <MenuItem icon={<Settings />} onClick={() => { close(); navigate("/settings"); }}>Settings</MenuItem>
                <MenuItem icon={dark ? <Sun /> : <Moon />} onClick={() => { close(); toggle(); }}>{dark ? "Light mode" : "Dark mode"}</MenuItem>
                <MenuItem icon={<LogOut />} onClick={signOut} danger>Sign out</MenuItem>
              </>
            )}
          </Menu>
        </div>
      </header>

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

      {/* ── Tab bar (mobile) ── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur lg:hidden">
        {[NAV[0], NAV[1], { to: "/campaigns/new", label: "New", icon: Plus, fab: true }, NAV[2], NAV[3]].map((item) => {
          const Icon = item.icon;
          if ("fab" in item) {
            return (
              <button key="fab" onClick={() => navigate(item.to)} className="flex flex-col items-center gap-0.5" aria-label="New campaign">
                <span className="-mt-5 flex size-12 items-center justify-center rounded-2xl bg-brand text-white shadow-pop">
                  <Icon className="size-6" />
                </span>
              </button>
            );
          }
          const n = badge((item as (typeof NAV)[number]).badge);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={(item as (typeof NAV)[number]).end}
              className={({ isActive }) => clsx("relative flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium", isActive ? "text-brand-text" : "text-ink-3")}
            >
              <Icon className="size-5" />
              {item.label}
              {n > 0 && <span className="absolute right-[22%] top-0 rounded-full bg-brand px-1 text-[10px] font-semibold text-white">{n}</span>}
            </NavLink>
          );
        })}
      </nav>
    </div>
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
