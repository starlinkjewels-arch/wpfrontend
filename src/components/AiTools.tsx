import { useState } from "react";
import { Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { Sparkles, Wand2, Scissors, Briefcase, Heart, SpellCheck, Languages, RotateCcw, Check, Loader2, Settings as SettingsIcon } from "lucide-react";
import { post, type AiTone } from "../lib/api";
import { useAiStatus } from "../lib/hooks";
import { Button, Label, Menu, Modal, Segmented } from "./ui";
import { WaText } from "./PhonePreview";

export const LANGUAGES = ["English", "Arabic", "Hindi", "French", "Spanish", "Italian", "German", "Russian", "Chinese", "Japanese", "Hebrew", "Turkish", "Thai", "Gujarati"];

export const TONE_LABELS: Record<AiTone, string> = {
  professional: "Professional",
  warm: "Warm",
  luxury: "Luxury",
  friendly: "Friendly",
  concise: "Short & direct",
};

const IDEAS = [
  "New collection launch — invite them to reply for the catalogue and B2B prices",
  "Share our latest price list and ask which pieces interest them",
  "Invite them to meet us at the upcoming jewellery show",
  "Festive greetings and thanks for their business this year",
  "Follow up with clients who have not ordered recently",
  "New stock of certified loose diamonds available now",
];

/** A small line under AI buttons when AI cannot be used yet, with the way to fix it. */
export function AiSetupHint({ className }: { className?: string }) {
  const { data } = useAiStatus();
  if (!data || data.ready) return null;
  return (
    <p className={clsx("flex items-center gap-1.5 text-[12px] text-ink-3", className)}>
      <SettingsIcon className="size-3.5" />
      {data.enabled ? "Add your Sarvam API key" : "Turn on AI"} in{" "}
      <Link to="/settings#ai" className="font-medium text-brand-text underline underline-offset-2">Settings → AI writer</Link>
    </p>
  );
}

/** "Write with AI": a brief in, a ready campaign message out. */
export function AiWriterModal({ open, onClose, onUse }: { open: boolean; onClose: () => void; onUse: (text: string) => void }) {
  const { data: ai } = useAiStatus();
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<AiTone | "">("");
  const [length, setLength] = useState<"short" | "medium" | "detailed">("medium");
  const [language, setLanguage] = useState("");
  const [result, setResult] = useState("");

  const gen = useMutation({
    mutationFn: () => post<{ text: string }>("/ai/compose", { brief, tone: tone || ai?.tone, length, language: language || ai?.language }),
    onSuccess: (r) => setResult(r.text),
    onError: (e: Error) => toast.error(e.message),
  });

  const close = () => {
    onClose();
    setResult("");
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-gold" /> Write with AI</span>}
      footer={
        result ? (
          <>
            <Button variant="ghost" onClick={() => setResult("")}>Change the brief</Button>
            <Button icon={<RotateCcw className="size-4" />} loading={gen.isPending} onClick={() => gen.mutate()}>Try again</Button>
            <Button variant="primary" icon={<Check className="size-4" />} onClick={() => { onUse(result); close(); }}>Use this message</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button variant="primary" icon={<Sparkles className="size-4" />} loading={gen.isPending} disabled={brief.trim().length < 5 || ai?.ready === false} onClick={() => gen.mutate()}>
              Write it
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div>
          <p className="mb-3 text-[13px] text-ink-3">
            Written for all clients — <b className="text-ink-2">{"{{first_name|Sir/Madam}}"}</b> becomes each client's name. You can still edit it after.
          </p>
          <div className="chat-wallpaper rounded-xl p-4">
            <div className="ml-auto max-w-[92%] whitespace-pre-wrap break-words rounded-lg rounded-tr-none bg-[var(--bubble-out)] px-3 py-2 text-[14px] leading-relaxed text-[#111b21] shadow-sm dark:text-[#e9edef]">
              <WaText text={result} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <Label htmlFor="ai-brief" hint="A sentence or two is enough">What do you want to tell your clients?</Label>
            <textarea
              id="ai-brief"
              autoFocus
              rows={4}
              className="field resize-y"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. Our new bridal collection is ready — solitaire rings and eternity bands, GIA certified. Invite them to reply for the catalogue and B2B prices."
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {IDEAS.map((i) => (
                <button key={i} type="button" onClick={() => setBrief(i)} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-left text-[12px] text-ink-2 hover:border-line-strong hover:text-ink">
                  {i.split(" — ")[0]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-ink-3">Mention real facts (offer, dates, place). The AI only uses facts you give here and in Settings — it never invents prices.</p>
          </div>
          <div>
            <Label>Tone</Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TONE_LABELS) as AiTone[]).map((t) => {
                const on = (tone || ai?.tone) === t;
                return (
                  <button key={t} type="button" onClick={() => setTone(t)} className={clsx("rounded-full border px-3 py-1.5 text-[13px] font-medium", on ? "border-brand bg-brand-soft text-brand-text" : "border-line text-ink-2 hover:border-line-strong")}>
                    {TONE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Length</Label>
              <Segmented value={length} onChange={setLength} options={[{ value: "short", label: "Short" }, { value: "medium", label: "Medium" }, { value: "detailed", label: "Detailed" }]} />
            </div>
            <div>
              <Label htmlFor="ai-lang">Language</Label>
              <select id="ai-lang" className="field" value={language || ai?.language || "English"} onChange={(e) => setLanguage(e.target.value)}>
                {[...new Set([ai?.language ?? "English", ...LANGUAGES])].map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          {gen.isPending && (
            <p className="flex items-center gap-2 text-[13px] text-ink-3"><Loader2 className="size-4 animate-spin" /> Writing — usually a few seconds…</p>
          )}
          <AiSetupHint />
        </div>
      )}
    </Modal>
  );
}

const ACTIONS = [
  { id: "improve", label: "Improve writing", icon: Wand2 },
  { id: "shorter", label: "Make shorter", icon: Scissors },
  { id: "formal", label: "More formal", icon: Briefcase },
  { id: "warmer", label: "Warmer", icon: Heart },
  { id: "grammar", label: "Fix spelling & grammar", icon: SpellCheck },
] as const;

/**
 * The ✨ AI menu beside a message box. Every change can be undone from the
 * toast, so trying an action costs nothing.
 */
export function AiMenu({ text, onChange, onWrite }: { text: string; onChange: (t: string) => void; onWrite: () => void }) {
  const { data: ai } = useAiStatus();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: string, language?: string) {
    if (!text.trim()) return toast.error("Write something first — or use “Write with AI”");
    setBusy(action);
    const before = text;
    try {
      const r = await post<{ text: string }>("/ai/rewrite", { text, action, language });
      onChange(r.text);
      toast.success(action === "translate" ? `Translated to ${language}` : "Message updated", { action: { label: "Undo", onClick: () => onChange(before) } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Menu
      align="left"
      trigger={() => (
        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gold-soft px-2.5 text-[13px] font-semibold text-gold hover:brightness-95 dark:hover:brightness-125" aria-label="AI writing tools">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} AI
        </button>
      )}
    >
      {(close) => (
        <div className="w-64">
          <button onClick={() => { close(); onWrite(); }} className="flex w-full items-center gap-2.5 rounded-lg bg-gold-soft/60 px-2.5 py-2 text-left text-[13px] font-semibold text-gold hover:bg-gold-soft">
            <Sparkles className="size-4" /> Write with AI…
          </button>
          <div className="my-1 h-px bg-line" />
          {ACTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { close(); run(id); }} disabled={Boolean(busy)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink hover:bg-surface-2 disabled:opacity-50">
              <Icon className="size-4 text-ink-3" /> {label}
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <div className="flex items-center gap-2 px-2.5 pb-1 pt-1.5 text-[12px] font-medium text-ink-3"><Languages className="size-3.5" /> Translate to</div>
          <div className="grid grid-cols-3 gap-1 px-1.5 pb-1.5">
            {LANGUAGES.slice(0, 9).map((l) => (
              <button key={l} onClick={() => { close(); run("translate", l); }} className="rounded-md px-1.5 py-1 text-[12px] text-ink-2 hover:bg-surface-2 hover:text-ink">{l}</button>
            ))}
          </div>
          {ai && !ai.ready && <AiSetupHint className="border-t border-line px-2.5 pt-2" />}
        </div>
      )}
    </Menu>
  );
}
