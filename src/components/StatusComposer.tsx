import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { CircleDashed, Image as ImageIcon, Loader2, Type, Info, X } from "lucide-react";
import { api, mediaUrl, post, uploadMedia, type Media, type StatusPost } from "../lib/api";
import { useMeta } from "../lib/hooks";
import { ago, num } from "../lib/format";
import { Button, Callout, Label, Modal, Segmented } from "./ui";
import { WaText } from "./PhonePreview";

const COLORS = ["#6d4aff", "#2563eb", "#db2777", "#0d9488", "#ea580c", "#111827"];

/**
 * Posting to WhatsApp Status: a text on a colour, or a photo or video with a
 * caption. It stays up for 24 hours, visible to clients who have this number
 * saved.
 */
export function StatusComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: meta } = useMeta();
  const [kind, setKind] = useState<"text" | "media">("media");
  const [text, setText] = useState("");
  const [caption, setCaption] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [media, setMedia] = useState<Media | null>(null);
  const [mode, setMode] = useState<"all" | "tags">("all");
  const [tags, setTags] = useState<string[]>([]);
  const file = useRef<HTMLInputElement>(null);

  const list = useQuery({
    queryKey: ["status-posts", mode, tags],
    queryFn: () => api<{ items: StatusPost[]; audienceCount: number }>(`/status-posts${mode === "tags" && tags.length ? `?tag=${encodeURIComponent(tags.join(","))}` : ""}`),
    enabled: open,
  });

  const upload = useMutation({ mutationFn: uploadMedia, onSuccess: setMedia, onError: (e: Error) => toast.error(e.message) });
  const postIt = useMutation({
    mutationFn: () =>
      post<StatusPost>("/status-posts", {
        text: kind === "text" ? text : "",
        caption: kind === "media" ? caption : "",
        mediaId: kind === "media" ? media?.id : undefined,
        backgroundColor: color,
        audience: { mode, tags },
      }),
    onSuccess: (p) => {
      toast.success(`Posted to Status for ${num(p.viewers)} clients`);
      setText("");
      setCaption("");
      setMedia(null);
      qc.invalidateQueries({ queryKey: ["status-posts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ready = kind === "text" ? text.trim().length > 0 : Boolean(media);
  const count = list.data?.audienceCount ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={<span className="flex items-center gap-2"><CircleDashed className="size-4 text-brand" /> Post to WhatsApp Status</span>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" loading={postIt.isPending} disabled={!ready || !count} onClick={() => postIt.mutate()}>
            Post for {num(count)} clients
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[{ value: "media", label: <><ImageIcon className="size-3.5" /> Photo or video</> }, { value: "text", label: <><Type className="size-3.5" /> Text</> }]}
          />
          {kind === "media" ? (
            <>
              <Button icon={upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />} onClick={() => file.current?.click()}>
                {media ? "Change photo or video" : "Choose photo or video"}
              </Button>
              <input ref={file} type="file" hidden accept="image/jpeg,image/png,image/webp,video/mp4" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
              <div>
                <Label htmlFor="st-cap" hint="Optional">Caption</Label>
                <textarea id="st-cap" rows={3} className="field resize-y" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="New oval solitaires, GIA certified 💎 Reply for prices." />
              </div>
            </>
          ) : (
            <>
              <textarea rows={4} maxLength={700} className="field resize-y" value={text} onChange={(e) => setText(e.target.value)} placeholder="Our booth at the Hong Kong show: Hall 3, D-12. See you there!" />
              <div className="flex items-center gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Background ${c}`} className={clsx("size-7 rounded-full ring-offset-2 ring-offset-surface", color === c && "ring-2 ring-brand")} style={{ background: c }} />
                ))}
              </div>
            </>
          )}

          <div>
            <Label>Who can see it</Label>
            <Segmented value={mode} onChange={setMode} options={[{ value: "all", label: "All clients" }, { value: "tags", label: "By tag" }]} />
            {mode === "tags" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(meta?.tags ?? []).map((t) => {
                  const on = tags.includes(t.tag);
                  return (
                    <button key={t.tag} type="button" onClick={() => setTags(on ? tags.filter((x) => x !== t.tag) : [...tags, t.tag])} className={clsx("rounded-full border px-2.5 py-1 text-[12px] font-medium", on ? "border-brand bg-brand text-white" : "border-line text-ink-2")}>
                      {t.tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Callout tone="neutral" icon={<Info />}>
            Status stays up for 24 hours. WhatsApp shows it only to clients who have <b>your number saved</b> in their phone — ask buyers to save it.
          </Callout>
        </div>

        {/* Phone-style preview */}
        <div>
          <div className="mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-2xl border-[5px] border-[#1c1c1e] bg-black shadow-pop">
            {kind === "text" ? (
              <div className="flex h-full items-center justify-center p-5 text-center text-[15px] font-medium leading-snug text-white" style={{ background: color }}>
                {text ? <span className="whitespace-pre-wrap break-words"><WaText text={text} /></span> : <span className="opacity-60">Your text</span>}
              </div>
            ) : media ? (
              <div className="relative flex h-full items-center justify-center">
                {media.kind === "video" ? <video src={mediaUrl(media.url)} className="max-h-full w-full object-contain" muted playsInline /> : <img src={mediaUrl(media.url)} alt="" className="max-h-full w-full object-contain" />}
                {caption && <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-center text-[12px] text-white">{caption}</div>}
                <button onClick={() => setMedia(null)} className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white" aria-label="Remove"><X className="size-3.5" /></button>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-white/50">Photo or video</div>
            )}
          </div>
        </div>
      </div>

      {(list.data?.items.length ?? 0) > 0 && (
        <div className="mt-6 border-t border-line pt-4">
          <h4 className="mb-2 text-[13px] font-semibold text-ink-2">Recent status posts</h4>
          <ul className="space-y-2">
            {list.data!.items.slice(0, 5).map((p) => {
              const live = p.expiresAt > Date.now();
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.kind === "text" ? p.backgroundColor : "var(--chart)" }} />
                  <span className="min-w-0 flex-1 truncate">{p.kind === "text" ? p.text : `${p.kind === "video" ? "Video" : "Photo"}${p.caption ? ` · ${p.caption}` : ""}`}</span>
                  <span className="shrink-0 text-[12px] text-ink-3">{num(p.viewers)} clients · {ago(p.postedAt)}</span>
                  <span className={clsx("shrink-0 text-[12px] font-medium", live ? "text-brand-text" : "text-ink-3")}>{live ? `Live · ${Math.ceil((p.expiresAt - Date.now()) / 3600000)}h left` : "Expired"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}
