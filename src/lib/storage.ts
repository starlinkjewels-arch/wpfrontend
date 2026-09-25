/**
 * localStorage for per-browser conveniences: the sign-in token, the theme,
 * an unsent campaign draft, the last filter used. Every access is guarded —
 * private windows and blocked site data throw — and the app works without it.
 */
export const local = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked — a convenience lost, nothing more */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ditto */
    }
  },
};
