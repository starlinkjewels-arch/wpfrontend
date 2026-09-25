import { Fragment, type ReactNode } from "react";
import clsx from "clsx";
import { CheckCheck, FileText, Play, ChevronLeft, Phone, Video } from "lucide-react";
import { mediaUrl, type Media } from "../lib/api";
import { fileSize } from "../lib/format";
import { Avatar } from "./ui";

/** WhatsApp's own formatting: *bold*, _italic_, ~strike~, ```mono```, and links. */
export function WaText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {formatLine(line)}
          {i < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}

function formatLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(```[^`]+```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/[^\s]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("```")) out.push(<code key={k++} className="font-mono text-[0.92em]">{t.slice(3, -3)}</code>);
    else if (t.startsWith("*")) out.push(<strong key={k++} className="font-semibold">{t.slice(1, -1)}</strong>);
    else if (t.startsWith("_")) out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    else if (t.startsWith("~")) out.push(<s key={k++}>{t.slice(1, -1)}</s>);
    else out.push(<span key={k++} className="text-[#027eb5] underline dark:text-[#53bdeb]">{t}</span>);
    last = m.index + t.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function MediaBlock({ media, className }: { media: Pick<Media, "kind" | "name" | "size" | "url" | "mimetype">; className?: string }) {
  if (media.kind === "image") {
    return <img src={mediaUrl(media.url)} alt={media.name} className={clsx("max-h-64 w-full rounded-md object-cover", className)} />;
  }
  if (media.kind === "video") {
    return (
      <div className={clsx("relative overflow-hidden rounded-md bg-black", className)}>
        <video src={mediaUrl(media.url)} className="max-h-64 w-full object-cover opacity-90" muted playsInline preload="metadata" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-black/55 text-white"><Play className="ml-0.5 size-5" /></span>
        </span>
      </div>
    );
  }
  return (
    <div className={clsx("flex items-center gap-3 rounded-md bg-black/5 p-2.5 dark:bg-white/5", className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#e8505b] text-[10px] font-bold uppercase text-white">
        {media.mimetype.includes("pdf") ? "PDF" : <FileText className="size-5" />}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium">{media.name}</div>
        <div className="text-[11px] opacity-60">{fileSize(media.size)}</div>
      </div>
    </div>
  );
}

/** A phone showing the message exactly as one client will receive it. */
export function PhonePreview({ text, media, contactName, business }: { text: string; media?: Media | null; contactName?: string; business?: string }) {
  const now = new Date().toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  const empty = !text.trim() && !media;
  return (
    <div className="mx-auto w-full max-w-[330px] rounded-[40px] border-[7px] border-[#1c1c1e] bg-[#1c1c1e] shadow-pop">
      <div className="overflow-hidden rounded-[33px]">
        {/* header, as the client sees it: your business */}
        <div className="flex items-center gap-2 bg-[#008069] px-3 pb-2.5 pt-7 text-white dark:bg-[#202c33]">
          <ChevronLeft className="size-5 opacity-90" />
          <Avatar name={business || "Starlink Jewels"} seed="business" size={32} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[14px] font-medium">{business || "Starlink Jewels"}</div>
            <div className="text-[11px] opacity-80">Business account</div>
          </div>
          <Video className="size-4 opacity-90" />
          <Phone className="ml-3 size-4 opacity-90" />
        </div>
        <div className="chat-wallpaper flex min-h-[430px] flex-col px-3 py-4">
          <div className="mx-auto mb-3 rounded-md bg-[var(--bubble-in)] px-2.5 py-1 text-[11px] text-ink-3 shadow-sm">TODAY</div>
          {empty ? (
            <div className="m-auto max-w-[200px] text-center text-[12px] text-ink-3">Your message will appear here, personalised for each client.</div>
          ) : (
            <div className="relative ml-auto max-w-[88%] rounded-lg rounded-tr-none bg-[var(--bubble-out)] p-1 text-[13.5px] leading-[1.4] text-[#111b21] shadow-sm dark:text-[#e9edef]">
              {media && <MediaBlock media={media} className="mb-1" />}
              {text.trim() && (
                <div className="whitespace-pre-wrap break-words px-1.5 pb-0.5 pt-0.5">
                  <WaText text={text} />
                  <span className="inline-block w-16" />
                </div>
              )}
              <span className="absolute bottom-1 right-2 flex items-center gap-0.5 text-[10.5px] opacity-60">
                {now} <CheckCheck className="size-3.5 text-[#53bdeb] opacity-100" />
              </span>
            </div>
          )}
          {contactName && !empty && <div className="mt-auto pt-4 text-center text-[11px] text-ink-3">Preview for <b>{contactName}</b></div>}
        </div>
      </div>
    </div>
  );
}
