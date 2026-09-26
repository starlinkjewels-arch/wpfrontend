import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { Building2, Clock, ShieldCheck, Bot, Save, Info, Database, Sparkles, KeyRound, ExternalLink, FlaskConical, Check } from "lucide-react";
import { post, put, type AiSettings, type AiTone, type Settings } from "../lib/api";
import { useAiStatus, useSettings, useStatus } from "../lib/hooks";
import { Badge, Button, Callout, Card, Label, Loading, PageHeader, Segmented, Switch } from "../components/ui";
import { TagInput } from "../components/TagInput";
import { LANGUAGES, TONE_LABELS } from "../components/AiTools";
import { WaText } from "../components/PhonePreview";
import { COUNTRY_OPTIONS, countryName, flag, num } from "../lib/format";

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Hong_Kong", "Asia/Singapore", "Asia/Bangkok", "Asia/Jerusalem", "Asia/Riyadh", "Europe/London", "Europe/Brussels", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC"];

export function SettingsPage() {
  const { data } = useSettings();
  const { data: status } = useStatus();
  const qc = useQueryClient();
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    if (data) setS(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => put<Settings>("/settings", s),
    onSuccess: (next) => {
      setS(next);
      qc.setQueryData(["settings"], next);
      qc.invalidateQueries({ queryKey: ["status"] });
      qc.invalidateQueries({ queryKey: ["ai-status"] });
      toast.success("Settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Links like /settings#ai land on their section once the page has content.
  useEffect(() => {
    if (!s || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [Boolean(s)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return <Loading />;
  const dirty = JSON.stringify(s) !== JSON.stringify(data);
  const up = (patch: Partial<Settings>) => setS({ ...s, ...patch });

  return (
    <div className="pb-24">
      <PageHeader title="Settings" subtitle="How your campaigns send, and what happens when clients write in." />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="hidden space-y-1 text-[13px] font-medium lg:sticky lg:top-8 lg:block lg:self-start">
          {[["business", "Business"], ["ai", "AI writer"], ["safety", "Sending safety"], ["inbound", "Incoming messages"], ["system", "System"]].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-2 text-ink-2 hover:bg-surface-2 hover:text-ink">{label}</a>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          <Section id="business" icon={<Building2 />} title="Business" subtitle="Used in messages as {{business_name}}.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="bn">Business name</Label>
                <input id="bn" className="field" value={s.businessName} onChange={(e) => up({ businessName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="dc" hint="For numbers without +code">Default country</Label>
                <select id="dc" className="field" value={s.defaultCountry} onChange={(e) => up({ defaultCountry: e.target.value })}>
                  {[...new Set([s.defaultCountry, ...COUNTRY_OPTIONS])].map((c) => <option key={c} value={c}>{flag(c)} {countryName(c)}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="tz" hint="For sending hours & daily limit">Your time zone</Label>
                <select id="tz" className="field" value={s.timezone} onChange={(e) => up({ timezone: e.target.value })}>
                  {[...new Set([s.timezone, ...TIMEZONES])].map((z) => <option key={z} value={z}>{z.replace("_", " ")}</option>)}
                </select>
              </div>
            </div>
          </Section>

          <AiSection s={s} up={up} dirty={dirty} />

          <Section id="safety" icon={<ShieldCheck />} title="Sending safety" subtitle="Protects your number from being flagged as spam.">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="lim" hint="messages">Daily limit</Label>
                  <input id="lim" type="number" min={1} max={5000} className="field" value={s.dailyLimit} onChange={(e) => up({ dailyLimit: Number(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="mind" hint="seconds">Default gap from</Label>
                  <input id="mind" type="number" min={3} className="field" value={s.minDelay} onChange={(e) => up({ minDelay: Number(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="maxd" hint="seconds">to</Label>
                  <input id="maxd" type="number" min={3} className="field" value={s.maxDelay} onChange={(e) => up({ maxDelay: Number(e.target.value) })} />
                </div>
              </div>
              <Callout tone="gold" icon={<Info />}>
                A new WhatsApp number should start around 50–100 messages a day and grow slowly over a few weeks. Established numbers that mostly message known buyers can handle a few hundred.
              </Callout>
              <div className="rounded-xl border border-line p-4">
                <Switch checked={s.window.enabled} onChange={(v) => up({ window: { ...s.window, enabled: v } })} label="Only send during business hours" description="A campaign pauses outside these hours and continues the next day by itself." />
                {s.window.enabled && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-2">
                    <Clock className="size-4 text-ink-3" /> From
                    <input type="time" className="field w-32" value={s.window.start} onChange={(e) => up({ window: { ...s.window, start: e.target.value } })} />
                    to
                    <input type="time" className="field w-32" value={s.window.end} onChange={(e) => up({ window: { ...s.window, end: e.target.value } })} />
                    <span className="text-[12px] text-ink-3">({s.timezone.replace("_", " ")})</span>
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section id="inbound" icon={<Bot />} title="Incoming messages" subtitle="What happens when someone writes to your WhatsApp.">
            <div className="space-y-4">
              <div className="rounded-xl border border-line p-4">
                <Switch checked={s.autoAddInbound} onChange={(v) => up({ autoAddInbound: v })} label="Save new numbers as clients" description="Anyone who messages you first is added to Clients with their WhatsApp name." />
                {s.autoAddInbound && (
                  <div className="mt-4 max-w-xs">
                    <Label htmlFor="itag">Tag them as</Label>
                    <input id="itag" className="field" value={s.inboundTag} onChange={(e) => up({ inboundTag: e.target.value })} placeholder="Inquiry" />
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-line p-4">
                <Switch checked={s.optOut.enabled} onChange={(v) => up({ optOut: { ...s.optOut, enabled: v } })} label="Stop messaging clients who reply STOP" description="They are removed from all campaigns — even one that is sending right now. Replying START adds them back." />
                {s.optOut.enabled && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <Label>Stop words</Label>
                      <TagInput value={s.optOut.keywords} onChange={(v) => up({ optOut: { ...s.optOut, keywords: v.map((k) => k.toUpperCase()) } })} />
                    </div>
                    <div>
                      <Label htmlFor="ooreply" hint="Leave empty to not reply">Confirmation message</Label>
                      <textarea id="ooreply" rows={2} className="field resize-y" value={s.optOut.reply} onChange={(e) => up({ optOut: { ...s.optOut, reply: e.target.value } })} />
                    </div>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-line p-4">
                <Switch checked={s.autoReply.enabled} onChange={(v) => up({ autoReply: { ...s.autoReply, enabled: v } })} label="Automatic reply" description="Answer new messages straight away — useful at night or during shows." />
                {s.autoReply.enabled && (
                  <div className="mt-4 space-y-3">
                    <textarea rows={3} className="field resize-y" value={s.autoReply.text} onChange={(e) => up({ autoReply: { ...s.autoReply, text: e.target.value } })} />
                    <Switch checked={s.autoReply.onlyNewContacts} onChange={(v) => up({ autoReply: { ...s.autoReply, onlyNewContacts: v } })} label="Only the first time someone writes" />
                    {!s.autoReply.onlyNewContacts && (
                      <div className="flex items-center gap-2 text-sm text-ink-2">
                        At most once every
                        <input type="number" min={1} className="field w-20" value={s.autoReply.cooldownHours} onChange={(e) => up({ autoReply: { ...s.autoReply, cooldownHours: Number(e.target.value) } })} />
                        hours per client
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section id="system" icon={<Database />} title="System" subtitle="Where things run.">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Info2 label="Mode" value={status?.demo ? "Demo (nothing is really sent)" : "Live"} />
              <Info2 label="Data stored in" value={status?.store === "firestore" ? "Firebase Firestore" : status?.store === "memory" ? "Memory (not saved)" : "Local files on the server"} />
              <Info2 label="WhatsApp" value={status?.wa.status === "connected" ? `Connected · ${status.wa.phoneDisplay}` : "Not connected"} />
              <Info2 label="Server" value={import.meta.env.VITE_API_URL || "Same address (development)"} />
            </dl>
          </Section>
        </div>
      </div>

      {dirty && (
        <div className="animate-pop fixed inset-x-3 bottom-24 z-30 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-line bg-surface p-2 pl-4 shadow-pop lg:bottom-6 lg:left-[260px]">
          <span className="flex-1 text-sm font-medium">You have unsaved changes</span>
          <Button variant="ghost" size="sm" onClick={() => setS(data ?? null)}>Discard</Button>
          <Button variant="primary" size="sm" icon={<Save className="size-4" />} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </div>
      )}
    </div>
  );
}

const CREATIVITY = [
  { value: 0.2, label: "Precise", note: "Sticks closely to your words" },
  { value: 0.6, label: "Balanced", note: "Natural and varied (recommended)" },
  { value: 1.0, label: "Creative", note: "More variety, check before sending" },
];

/** Everything about how the AI writes, managed by the admin. */
function AiSection({ s, up, dirty }: { s: Settings; up: (p: Partial<Settings>) => void; dirty: boolean }) {
  const ai = s.ai;
  const set = (p: Partial<AiSettings>) => up({ ai: { ...ai, ...p } });
  const { data: status } = useAiStatus();
  const [replacing, setReplacing] = useState(false);
  // A new key was saved: show its hint instead of the empty box again.
  useEffect(() => setReplacing(false), [ai.keyHint]);
  const models = status?.models ?? ["sarvam-105b", "sarvam-105b-conversations"];
  const customModel = !models.includes(ai.model);
  const test = useMutation({
    mutationFn: () => post<{ text: string; model: string; ms: number }>("/ai/test"),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section id="ai" icon={<Sparkles />} title="AI writer" subtitle="Sarvam AI writes, polishes and personalises your messages.">
      <div className="space-y-5">
        <div className="rounded-xl border border-line p-4">
          <Switch checked={ai.enabled} onChange={(v) => set({ enabled: v })} label="Use AI to write messages" description="Write with AI, the ✨ AI menu, per-client messages in campaigns, and suggested replies in the inbox." />
        </div>

        {/* API key: never shown, only its ends */}
        <div>
          <Label hint={<a href="https://dashboard.sarvam.ai" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-text hover:underline">Get a key <ExternalLink className="size-3" /></a>}>
            Sarvam API key
          </Label>
          {ai.hasKey && !replacing ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
              <KeyRound className="size-4 text-brand" />
              <span className="font-mono text-[13px]">{ai.keyHint}</span>
              <Badge tone="brand">{ai.keySource === "server" ? "Set on the server" : "Saved"}</Badge>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setReplacing(true)}>Replace</Button>
                {ai.keySource === "settings" && (
                  <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => set({ clearKey: true, hasKey: false, keyHint: null, keySource: null })}>Remove</Button>
                )}
              </div>
            </div>
          ) : (
            <input
              type="password"
              autoComplete="off"
              className="field font-mono"
              placeholder="sk_…"
              value={ai.apiKey ?? ""}
              onChange={(e) => set({ apiKey: e.target.value, clearKey: false })}
            />
          )}
          <p className="mt-1.5 text-[12px] text-ink-3">Kept on the server only — it is never shown again or sent to this browser.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ai-model" hint="sarvam-105b is the default">Model</Label>
            <select
              id="ai-model"
              className="field"
              value={customModel ? "__custom" : ai.model}
              onChange={(e) => set({ model: e.target.value === "__custom" ? "" : e.target.value })}
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}{m === "sarvam-105b" ? " — best quality (default)" : m === "sarvam-105b-conversations" ? " — tuned for chat" : ""}
                </option>
              ))}
              <option value="__custom">Other model name…</option>
            </select>
            {customModel && (
              <input className="field mt-2 font-mono" placeholder="model name" value={ai.model} onChange={(e) => set({ model: e.target.value.trim() })} />
            )}
          </div>
          <div>
            <Label htmlFor="ai-lang" hint="Default for new messages">Language</Label>
            <select id="ai-lang" className="field" value={ai.language} onChange={(e) => set({ language: e.target.value })}>
              {[...new Set([ai.language, ...LANGUAGES])].map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div>
          <Label>Default tone</Label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TONE_LABELS) as AiTone[]).map((t) => (
              <button key={t} type="button" onClick={() => set({ tone: t })} className={clsx("rounded-full border px-3 py-1.5 text-[13px] font-medium", ai.tone === t ? "border-brand bg-brand-soft text-brand-text" : "border-line text-ink-2 hover:border-line-strong")}>
                {TONE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Creativity</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {CREATIVITY.map((c) => {
                const on = Math.abs(ai.temperature - c.value) < 0.15;
                return (
                  <button key={c.label} type="button" title={c.note} onClick={() => set({ temperature: c.value })} className={clsx("rounded-lg border px-2 py-2 text-[13px] font-medium", on ? "border-brand bg-brand-soft text-brand-text" : "border-line text-ink-2 hover:border-line-strong")}>
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[12px] text-ink-3">{CREATIVITY.find((c) => Math.abs(ai.temperature - c.value) < 0.15)?.note ?? `Custom (${ai.temperature})`}</p>
          </div>
          <div>
            <Label hint="Off is fastest and cheapest">Thinking</Label>
            <Segmented
              value={ai.reasoning}
              onChange={(v) => set({ reasoning: v })}
              options={[{ value: "off", label: "Off" }, { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]}
            />
            <p className="mt-1.5 text-[12px] text-ink-3">Short messages rarely need it; it makes each answer slower.</p>
          </div>
        </div>

        <div>
          <Label htmlFor="ai-profile" hint="The AI uses ONLY these facts">About your business</Label>
          <textarea
            id="ai-profile"
            rows={5}
            className="field resize-y"
            value={ai.businessProfile}
            onChange={(e) => set({ businessProfile: e.target.value })}
            placeholder="What you make and sell, certifications, where you ship, what makes you different…"
          />
          <p className="mt-1.5 text-[12px] text-ink-3">Write real facts: products, certifications (GIA/IGI), MOQ, shipping, payment terms. The AI will not invent prices or offers that are not here or in your brief.</p>
        </div>

        <div>
          <Label htmlFor="ai-rules" hint="Optional">Extra rules for the AI</Label>
          <textarea
            id="ai-rules"
            rows={3}
            className="field resize-y"
            value={ai.instructions}
            onChange={(e) => set({ instructions: e.target.value })}
            placeholder={"e.g. Always sign as “Team Starlink”. Never use the word “cheap”. Mention free insured shipping on orders over $10,000."}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
          <Button size="sm" icon={<FlaskConical className="size-4" />} loading={test.isPending} disabled={dirty || !ai.enabled} onClick={() => test.mutate()}>
            Test AI
          </Button>
          <span className="text-[12px] text-ink-3">
            {dirty ? "Save your changes first, then test." : status ? `Today: ${num(status.usageToday.requests)} AI requests · ${num(status.usageToday.tokens)} tokens` : ""}
          </span>
        </div>
        {test.data && (
          <div className="rounded-xl border border-line p-4">
            <div className="mb-2 flex items-center gap-2 text-[12px] text-ink-3">
              <Check className="size-3.5 text-brand" /> {test.data.model} answered in {(test.data.ms / 1000).toFixed(1)}s
            </div>
            <div className="whitespace-pre-wrap text-[14px] leading-relaxed"><WaText text={test.data.text} /></div>
          </div>
        )}
      </div>
    </Section>
  );
}

function Section({ id, icon, title, subtitle, children }: { id: string; icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-6 p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text [&>svg]:size-[18px]">{icon}</span>
        <div>
          <h2 className="text-[16px] font-semibold">{title}</h2>
          <p className="text-[13px] text-ink-3">{subtitle}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

function Info2({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3.5 py-2.5">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-ink">{value}</dd>
    </div>
  );
}
