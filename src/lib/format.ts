import { parsePhoneNumberFromString } from "libphonenumber-js/min";

/** Numbers, dates, phones and countries, formatted the one way the app shows them. */

export const nf = new Intl.NumberFormat("en-IN");

export function num(n: number | null | undefined) {
  return nf.format(n ?? 0);
}

export function compact(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function pct(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

const dtf = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const df = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const tf = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });

export function dateTime(ms?: number | null) {
  return ms ? dtf.format(ms) : "—";
}
export function date(ms?: number | null) {
  return ms ? df.format(ms) : "—";
}
export function time(ms?: number | null) {
  return ms ? tf.format(ms) : "";
}

/** "Today 4:30 pm", "Tomorrow 10:00 am", "Mon 3 Oct, 9:00 am". */
export function friendlyWhen(ms?: number | null) {
  if (!ms) return "—";
  const d = new Date(ms);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(d) - startOf(today)) / 86400000);
  const t = tf.format(d).toLowerCase();
  if (diffDays === 0) return `Today ${t}`;
  if (diffDays === 1) return `Tomorrow ${t}`;
  if (diffDays === -1) return `Yesterday ${t}`;
  return `${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(d)}, ${t}`;
}

export function ago(ms?: number | null) {
  if (!ms) return "";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return date(ms);
}

/** Chat-list time: time today, weekday this week, date otherwise. */
export function chatTime(ms?: number | null) {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return tf.format(d).toLowerCase();
  if (now.getTime() - ms < 6 * 86400000) return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(d);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
}

export function duration(ms: number) {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "under a minute";
  if (mins < 60) return `about ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `about ${h}h${m ? ` ${m}m` : ""}`;
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ── Phones ─────────────────────────────────────────────────────────── */

/** +971 50 123 4567 — the grouping each country actually uses. */
export function phone(p?: string | null) {
  if (!p) return "";
  const digits = String(p).replace(/D/g, "");
  if (!digits) return String(p);
  const parsed = parsePhoneNumberFromString("+" + digits);
  return parsed ? parsed.formatInternational() : "+" + digits;
}

export function waLink(p: string) {
  return `https://wa.me/${String(p).replace(/\D/g, "")}`;
}

/* ── Countries ──────────────────────────────────────────────────────── */

let regionNames: Intl.DisplayNames | null = null;
export function countryName(code?: string | null) {
  if (!code) return "";
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function flag(code?: string | null) {
  if (!code || !/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Two letters for an avatar. */
export function initials(name?: string | null, fallback = "#") {
  const words = String(name ?? "").replace(/^(mr|mrs|ms|dr|shri)\.?\s+/i, "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
}

/** Stable pleasant avatar tint from a string. */
export function tint(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hues = [158, 200, 32, 262, 340, 188, 20, 222];
  return hues[h % hues.length];
}

export const COUNTRY_OPTIONS = [
  "IN", "AE", "US", "GB", "HK", "BE", "IL", "SA", "QA", "KW", "OM", "BH", "SG", "TH", "CN", "JP", "AU", "CA", "DE", "FR", "IT", "CH", "NL", "RU", "TR", "ZA", "LK", "MY", "ID", "KR", "TW",
];
