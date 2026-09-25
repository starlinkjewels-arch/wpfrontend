import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Tag } from "./ui";

/** Chips plus a text box. Enter or comma adds; suggestions come from existing tags. */
export function TagInput({ value, onChange, suggestions = [], placeholder = "Add a tag…", className }: { value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; placeholder?: string; className?: string }) {
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const parts = raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p.slice(0, 40));
    onChange(next);
    setText("");
  };

  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    return suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()) && (!q || s.toLowerCase().includes(q))).slice(0, 8);
  }, [suggestions, value, text]);

  return (
    <div className={clsx("relative", className)}>
      <div
        className="field flex min-h-10 cursor-text flex-wrap items-center gap-1.5 !py-1.5"
        onClick={() => input.current?.focus()}
      >
        {value.map((t) => (
          <Tag key={t} onRemove={() => onChange(value.filter((x) => x !== t))}>
            {t}
          </Tag>
        ))}
        <input
          ref={input}
          value={text}
          onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setTimeout(() => setFocus(false), 120);
            if (text.trim()) add(text);
          }}
          placeholder={value.length ? "" : placeholder}
          className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-ink-3"
        />
      </div>
      {focus && matches.length > 0 && (
        <div className="animate-pop absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop">
          {matches.map((m) => (
            <button key={m} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(m)} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-2">
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
