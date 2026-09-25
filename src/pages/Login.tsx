import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { Eye, EyeOff, Lock, ShieldCheck, Sparkles, Users, CalendarClock } from "lucide-react";
import { api, auth, ApiError } from "../lib/api";
import { Button, Label } from "../components/ui";
import { Logo } from "../components/Logo";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return setError("Enter your password");
    setBusy(true);
    setError("");
    try {
      const res = await api<{ token: string }>("/auth/login", { method: "POST", body: { password } });
      auth.set(res.token);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-[#0b2a22] p-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 20% 10%, rgba(214,170,85,.28), transparent 60%), radial-gradient(50% 60% at 90% 90%, rgba(34,168,120,.35), transparent 60%)",
          }}
        />
        <svg aria-hidden viewBox="0 0 400 400" className="absolute -right-24 top-1/2 size-[560px] -translate-y-1/2 opacity-[0.09]" fill="none" stroke="white">
          <path d="M60 150 130 60h140l70 90-140 190z" strokeWidth="3" />
          <path d="M60 150h280M165 150l35 190 35-190M130 60l35 90 35-90 35 90 35-90" strokeWidth="2" />
        </svg>
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <Sparkles className="size-5 text-[#e6c77f]" />
            </span>
            <span className="font-display text-xl">Starlink Jewels</span>
          </div>
        </div>
        <div className="relative mt-auto max-w-md">
          <h1 className="font-display text-[44px] font-light leading-[1.08] tracking-tight">
            Every client, <em className="text-[#e6c77f]">personally</em> — at scale.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Import your buyers from Excel, write one message, and let it reach each of them by name on WhatsApp — one by one, at the time you choose.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            <li className="flex items-center gap-3"><Users className="size-4 text-[#e6c77f]" /> Clients from any country, cleaned automatically</li>
            <li className="flex items-center gap-3"><CalendarClock className="size-4 text-[#e6c77f]" /> Schedule campaigns, safe sending speed</li>
            <li className="flex items-center gap-3"><ShieldCheck className="size-4 text-[#e6c77f]" /> New enquiries saved as clients by themselves</li>
          </ul>
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />
          <h2 className="font-display text-3xl font-medium tracking-tight">Welcome back</h2>
          <p className="mt-1.5 text-sm text-ink-2">Sign in to manage your WhatsApp campaigns.</p>
          <div className="mt-8">
            <Label htmlFor="pw">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input
                id="pw"
                type={show ? "text" : "password"}
                autoFocus
                autoComplete="current-password"
                className="field h-11 pl-9 pr-10"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-3 hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
          </div>
          <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-6 w-full">
            Sign in
          </Button>
          <p className="mt-6 text-center text-[12px] text-ink-3">The password is set on the server as ADMIN_PASSWORD.</p>
        </form>
      </div>
    </div>
  );
}
