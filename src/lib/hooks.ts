import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type AiStatus, type ContactsMeta, type Settings, type Status } from "./api";

/** Whether AI can be used right now, the model, and today's usage. */
export function useAiStatus() {
  return useQuery({ queryKey: ["ai-status"], queryFn: () => api<AiStatus>("/ai/status"), staleTime: 30000 });
}

/** Polled by every page: connection, unread count, what the runner is doing. */
export function useStatus() {
  return useQuery({
    queryKey: ["status"],
    queryFn: () => api<Status>("/status"),
    refetchInterval: (q) => (q.state.data?.wa.status === "connected" ? 5000 : 2500),
    refetchIntervalInBackground: false,
  });
}

export function useMeta() {
  return useQuery({ queryKey: ["contacts-meta"], queryFn: () => api<ContactsMeta>("/contacts/meta"), staleTime: 15000 });
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/settings"), staleTime: 60000 });
}

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Re-render every `ms` — for countdowns and "2m ago". */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
