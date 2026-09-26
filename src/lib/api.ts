/**
 * Talking to the backend.
 *
 * The backend is on its own host (Render); VITE_API_URL says where. The
 * session token lives in localStorage and goes out as a Bearer header.
 */
import { local } from "./storage";

export const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const TOKEN_KEY = "sl.token";

export const auth = {
  get token(): string | null {
    return local.get<string | null>(TOKEN_KEY, null);
  },
  set(token: string) {
    local.set(TOKEN_KEY, token);
  },
  clear() {
    local.remove(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  code: string | null;
  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Every page listens for this to send the person back to sign in. */
export const UNAUTHORIZED_EVENT = "sl:unauthorized";

export function mediaUrl(path: string | null | undefined) {
  if (!path) return "";
  return path.startsWith("http") ? path : API_BASE + path;
}

type Opts = { method?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string>; signal?: AbortSignal };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  const token = auth.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined = opts.raw;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { method: opts.method ?? (body ? "POST" : "GET"), headers, body, signal: opts.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(
      "Cannot reach the server. If it was idle it may be waking up — wait 30 seconds and try again.",
      0,
      "NETWORK",
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) {
      auth.clear();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.code ?? null);
  }
  return data as T;
}

export const post = <T = unknown>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body ?? {} });
export const put = <T = unknown>(path: string, body?: unknown) => api<T>(path, { method: "PUT", body: body ?? {} });
export const del = <T = unknown>(path: string) => api<T>(path, { method: "DELETE" });

export async function uploadMedia(file: File): Promise<Media> {
  return api<Media>("/media", {
    method: "POST",
    raw: file,
    headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
  });
}

/* ── Shapes the backend returns ─────────────────────────────────────── */

export type WaState = {
  status: "connected" | "qr" | "disconnected" | "waiting";
  phone: string | null;
  phoneDisplay: string | null;
  qr: string | null;
  halted: boolean;
  error: string | null;
};

export type Waiting = { campaignId: string; code: "disconnected" | "window" | "limit" | "gap" | "error"; reason: string; until?: number };

export type Status = {
  demo: boolean;
  store: string;
  dataReady: boolean;
  dataError: string | null;
  wa: WaState;
  unread: number;
  runner: { activeId: string | null; waiting: Waiting | null };
  sentToday: number;
  dailyLimit: number | null;
  businessName: string;
};

export type Contact = {
  id: string;
  phone: string;
  name: string;
  company: string;
  email: string;
  country: string;
  city: string;
  tags: string[];
  notes: string;
  fields: Record<string, string>;
  optedOut: boolean;
  waStatus: "unknown" | "valid" | "invalid";
  source: "import" | "manual" | "inbound";
  createdAt: number;
  updatedAt: number;
  lastMessageAt?: number;
  lastCampaignAt?: number;
};

export type Counts = { total: number; active: number; optedOut: number; invalid: number; inbound: number };

export type Media = { id: string; name: string; kind: "image" | "video" | "document"; mimetype: string; size: number; url: string };

export type Audience = {
  mode: "all" | "tags" | "contacts";
  tags: string[];
  tagMatch: "any" | "all";
  contactIds: string[];
  excludeTags: string[];
};

export type CampaignStatus = "draft" | "scheduled" | "queued" | "running" | "paused" | "completed" | "cancelled";

export type Stats = { total: number; pending: number; sent: number; failed: number; skipped: number };

export type Campaign = {
  id: string;
  name: string;
  message: string;
  mediaId: string | null;
  media: Media | null;
  audience: Audience;
  minDelay: number;
  maxDelay: number;
  scheduledAt: number | null;
  status: CampaignStatus;
  stats: Stats | null;
  materialized?: boolean;
  audienceCount?: number;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  finishedAt?: number;
  pausedReason?: string | null;
  ai?: { personalize: boolean };
  note?: string;
  waiting: Waiting | null;
  eta: number | null;
};

export type Recipient = { phone: string; name: string; company: string; status: "pending" | "sent" | "failed" | "skipped"; error: string | null; at: number | null };

export type Template = { id: string; name: string; message: string; mediaId: string | null; media: Media | null; createdAt: number; updatedAt: number };

export type Conversation = {
  id: string;
  phone: string;
  jid: string | null;
  name: string;
  company: string;
  tags: string[];
  lastText: string;
  lastDir: "in" | "out";
  lastAt: number;
  unread: number;
  isNew: boolean;
  optedOut: boolean;
};

export type ChatMessage = { id: string; dir: "in" | "out"; text: string; at: number; campaignId?: string; mediaType?: string };

export type Settings = {
  businessName: string;
  defaultCountry: string;
  timezone: string;
  minDelay: number;
  maxDelay: number;
  dailyLimit: number;
  window: { enabled: boolean; start: string; end: string };
  autoAddInbound: boolean;
  inboundTag: string;
  optOut: { enabled: boolean; keywords: string[]; reply: string };
  autoReply: { enabled: boolean; onlyNewContacts: boolean; cooldownHours: number; text: string };
  onboardingDismissed: boolean;
  ai: AiSettings;
};

export type Day = { date: string; sent: number; failed: number; inbound: number; newContacts: number; aiRequests?: number; aiTokens?: number };

/* ── AI writer ──────────────────────────────────────────────────────── */

export type AiTone = "professional" | "warm" | "luxury" | "friendly" | "concise";

/** As the server shows it: the key itself is never sent, only whether one is set. */
export type AiSettings = {
  enabled: boolean;
  model: string;
  temperature: number;
  reasoning: "off" | "low" | "medium" | "high";
  tone: AiTone;
  language: string;
  businessProfile: string;
  instructions: string;
  hasKey: boolean;
  keySource: "settings" | "server" | null;
  keyHint: string | null;
  /** Only ever sent TO the server, when the admin types a new key. */
  apiKey?: string;
  clearKey?: boolean;
};

export type AiStatus = {
  enabled: boolean;
  ready: boolean;
  model: string;
  models: string[];
  tones: AiTone[];
  language: string;
  tone: AiTone;
  demo: boolean;
  usageToday: { requests: number; tokens: number };
};

export type AiDraftState = "ready" | "edited" | "outdated" | "missing";

export type AiDraftRow = { phone: string; name: string; company: string; country: string; text: string; state: AiDraftState; at: number | null };

export type AiJob = { campaignId: string; mode: string; total: number; done: number; failed: number; running: boolean; startedAt: number; finishedAt: number | null; lastError: string | null };

export type AiDrafts = {
  counts: Record<AiDraftState | "total", number>;
  job: AiJob | null;
  total: number;
  page: number;
  pageSize: number;
  items: AiDraftRow[];
};

export type ContactsMeta = {
  tags: { tag: string; count: number }[];
  fields: { key: string; count: number }[];
  builtIn: { key: string; label: string }[];
  counts: Counts;
};
