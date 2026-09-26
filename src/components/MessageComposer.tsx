import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { Bold, Italic, Strikethrough, Paperclip, Shuffle, Smile, X, FileText, BookmarkPlus, Library, Loader2, Braces, ImageIcon, Sparkles } from "lucide-react";
import { api, post, uploadMedia, type Media, type Template } from "../lib/api";
import { useMeta } from "../lib/hooks";
import { fileSize } from "../lib/format";
import { Button, Modal, Empty, Label } from "./ui";
import { MediaBlock } from "./PhonePreview";
import { AiMenu, AiWriterModal } from "./AiTools";

const EMOJI = ["💎", "✨", "💍", "👑", "🌟", "🎉", "🙏", "📦", "📞", "👇", "✅", "🔥", "🪔", "🎁", "📍", "🤝"];

/**
 * Where the message is written.
 *
 * Variables go in as chips the person clicks rather than syntax they type;
 * formatting buttons wrap the selection in WhatsApp's own markers.
 */
export function MessageComposer({
  message,
  onMessage,
  media,
  onMedia,
  missing = [],
}: {
  message: string;
  onMessage: (m: string) => void;
  media: Media | null;
  onMedia: (m: Media | null) => void;
  missing?: { key: string; label: string; missing: number }[];
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const { data: meta } = useMeta();
  const [emoji, setEmoji] = useState(false);
  const [spinHelp, setSpinHelp] = useState(false);
  const [templates, setTemplates] = useState(false);
  const [saveTpl, setSaveTpl] = useState(false);
  const [writer, setWriter] = useState(false);

  const upload = useMutation({
    mutationFn: uploadMedia,
    onSuccess: (m) => onMedia(m),
    onError: (e: Error) => toast.error(e.message),
  });

  /** Insert at the cursor, or wrap the selection. */
  function insert(before: string, after = "") {
    const el = ta.current;
    if (!el) return onMessage(message + before + after);
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = message.slice(s, e);
    const next = message.slice(0, s) + before + selected + after + message.slice(e);
    onMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = s + before.length + selected.length + (selected ? after.length : 0);
      el.setSelectionRange(selected ? pos : s + before.length, selected ? pos : s + before.length);
    });
  }

  const vars = [
    ...(meta?.builtIn ?? [
      { key: "name", label: "Name" },
      { key: "first_name", label: "First name" },
      { key: "company", label: "Company" },
    ]).filter((v) => v.key !== "phone" && v.key !== "email"),
    ...(meta?.fields ?? []).slice(0, 12).map((f) => ({ key: f.key, label: f.key })),
  ];

  const onPick = (f?: File) => {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) return toast.error("Files must be 15 MB or smaller for WhatsApp");
    upload.mutate(f);
  };

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface transition-shadow focus-within:border-brand focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_18%,transparent)]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-surface-2/60 px-2 py-1.5">
          <ToolBtn label="Bold" onClick={() => insert("*", "*")}><Bold /></ToolBtn>
          <ToolBtn label="Italic" onClick={() => insert("_", "_")}><Italic /></ToolBtn>
          <ToolBtn label="Strikethrough" onClick={() => insert("~", "~")}><Strikethrough /></ToolBtn>
          <span className="mx-1 h-5 w-px bg-line" />
          <div className="relative">
            <ToolBtn label="Emoji" onClick={() => setEmoji((v) => !v)}><Smile /></ToolBtn>
            {emoji && (
              <div className="animate-pop absolute left-0 top-full z-30 mt-1 grid w-56 grid-cols-8 gap-0.5 rounded-xl border border-line bg-surface p-2 shadow-pop">
                {EMOJI.map((e) => (
                  <button key={e} type="button" className="rounded-md p-1 text-lg hover:bg-surface-2" onClick={() => { insert(e); setEmoji(false); }}>{e}</button>
                ))}
              </div>
            )}
          </div>
          <ToolBtn label="Random words" onClick={() => setSpinHelp(true)}><Shuffle /></ToolBtn>
          <ToolBtn label="Attach photo, video or PDF" onClick={() => file.current?.click()}><Paperclip /></ToolBtn>
          <span className="mx-1 h-5 w-px bg-line" />
          <AiMenu text={message} onChange={onMessage} onWrite={() => setWriter(true)} />
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" icon={<Library className="size-4" />} onClick={() => setTemplates(true)}>Templates</Button>
            <Button size="sm" variant="ghost" icon={<BookmarkPlus className="size-4" />} onClick={() => setSaveTpl(true)} disabled={!message.trim() && !media} className="max-sm:!hidden">Save</Button>
          </div>
        </div>

        <textarea
          ref={ta}
          value={message}
          onChange={(e) => onMessage(e.target.value)}
          rows={9}
          maxLength={4000}
          placeholder={"Hello {{first_name|Sir/Madam}},\n\nOur new collection of certified diamond jewellery is ready…"}
          className="block w-full resize-y bg-transparent px-4 py-3 text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-3"
        />

        {!message.trim() && (
          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={() => setWriter(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold-soft px-3.5 py-2 text-[13px] font-semibold text-gold transition hover:brightness-95 dark:hover:brightness-125"
            >
              <Sparkles className="size-4" /> Not sure what to write? Let AI write it
            </button>
          </div>
        )}

        {/* Variables */}
        <div className="border-t border-line px-3 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink-3">
            <Braces className="size-3.5" /> Tap to add client details — filled in for each client
          </div>
          <div className="flex flex-wrap gap-1.5">
            {vars.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insert(`{{${v.label === v.key ? v.key : v.key}}}`)}
                className="rounded-full border border-brand/25 bg-brand-soft px-2.5 py-1 text-[12px] font-medium text-brand-text transition hover:border-brand/50"
              >
                + {v.label}
              </button>
            ))}
            <button type="button" onClick={() => insert("{{business_name}}")} className="rounded-full border border-gold/30 bg-gold-soft px-2.5 py-1 text-[12px] font-medium text-gold">
              + Your business name
            </button>
            {!/reply stop/i.test(message) && (
              <button
                type="button"
                onClick={() => onMessage(message.replace(/\s+$/, "") + "\n\n_Reply STOP to unsubscribe_")}
                title="Clients who reply STOP are removed from future campaigns automatically"
                className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:border-line-strong"
              >
                + Opt-out line
              </button>
            )}
          </div>
        </div>

        {(media || upload.isPending) && (
          <div className="border-t border-line p-3">
            {upload.isPending ? (
              <div className="flex items-center gap-2 text-[13px] text-ink-3"><Loader2 className="size-4 animate-spin" /> Uploading…</div>
            ) : (
              media && (
                <div className="flex items-center gap-3">
                  <div className="w-20 shrink-0 overflow-hidden rounded-lg">
                    {media.kind === "document" ? <span className="flex h-14 items-center justify-center rounded-lg bg-surface-2"><FileText className="size-6 text-ink-3" /></span> : <MediaBlock media={media} className="!max-h-14" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">{media.kind === "image" ? <ImageIcon className="size-3.5" /> : <Paperclip className="size-3.5" />}{media.name}</div>
                    <div className="text-[12px] text-ink-3">{fileSize(media.size)} · the message becomes its caption</div>
                  </div>
                  <button type="button" onClick={() => onMedia(null)} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Remove attachment"><X className="size-4" /></button>
                </div>
              )
            )}
          </div>
        )}
        <input ref={file} type="file" hidden accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf,.xlsx,.docx,.pptx" onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-3">
        <span>Use <b>{"{{name|Sir}}"}</b> to write "Sir" when a client has no name.</span>
        <span className={clsx(message.length > 3500 && "text-warn")}>{message.length} / 4000</span>
      </div>
      {missing.length > 0 && (
        <div className="mt-3 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">
          {missing.map((m) => (
            <div key={m.key}>
              <b>{m.missing}</b> client{m.missing === 1 ? " has" : "s have"} no <b>{m.label}</b> — they'll see a blank. Add a fallback like <code className="rounded bg-surface/60 px-1">{`{{${m.label}|Sir}}`}</code>
            </div>
          ))}
        </div>
      )}

      <Modal open={spinHelp} onClose={() => setSpinHelp(false)} title="Random words" size="sm" footer={<Button variant="primary" onClick={() => { insert("{Hello|Hi|Dear}"); setSpinHelp(false); }}>Insert example</Button>}>
        <p className="text-sm text-ink-2">
          Write options in single curly brackets separated by <b>|</b>. Each client gets one of them at random:
        </p>
        <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2 font-mono text-[13px]">{"{Hello|Hi|Dear} {{first_name}}"}</div>
        <p className="mt-3 text-sm text-ink-2">
          Messages that are not all identical look more natural to WhatsApp and lower the risk of your number being flagged.
        </p>
      </Modal>
      <AiWriterModal
        open={writer}
        onClose={() => setWriter(false)}
        onUse={(t) => {
          const before = message;
          onMessage(t);
          if (before.trim()) toast.success("AI message added", { action: { label: "Undo", onClick: () => onMessage(before) } });
        }}
      />
      <TemplatePicker open={templates} onClose={() => setTemplates(false)} onPick={(t) => { onMessage(t.message); onMedia(t.media); setTemplates(false); toast.success(`Loaded "${t.name}"`); }} />
      <SaveTemplate open={saveTpl} onClose={() => setSaveTpl(false)} message={message} mediaId={media?.id ?? null} />
    </div>
  );
}

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="flex size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface hover:text-ink [&>svg]:size-4">
      {children}
    </button>
  );
}

function TemplatePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (t: Template) => void }) {
  const { data } = useQuery({ queryKey: ["templates"], queryFn: () => api<{ items: Template[] }>("/templates"), enabled: open });
  return (
    <Modal open={open} onClose={onClose} title="Use a template" size="md">
      {!data?.items.length ? (
        <Empty icon={<Library className="size-6" />} title="No templates yet">Write a message and press Save to reuse it later.</Empty>
      ) : (
        <div className="space-y-2">
          {data.items.map((t) => (
            <button key={t.id} onClick={() => onPick(t)} className="block w-full rounded-xl border border-line p-3.5 text-left transition-colors hover:border-brand/50 hover:bg-brand-soft/40">
              <div className="flex items-center gap-2 text-sm font-semibold">{t.name}{t.media && <Paperclip className="size-3.5 text-ink-3" />}</div>
              <div className="mt-1 line-clamp-2 text-[13px] text-ink-3">{t.message}</div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function SaveTemplate({ open, onClose, message, mediaId }: { open: boolean; onClose: () => void; message: string; mediaId: string | null }) {
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () => post("/templates", { name, message, mediaId }),
    onSuccess: () => {
      toast.success("Template saved");
      qc.invalidateQueries({ queryKey: ["templates"] });
      setName("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save as template"
      size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name.trim()} loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}
    >
      <Label htmlFor="tpl-name">Template name</Label>
      <input id="tpl-name" className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New arrivals" onKeyDown={(e) => e.key === "Enter" && name.trim() && save.mutate()} />
    </Modal>
  );
}
