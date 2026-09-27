import type { BatchColor } from "./api";

/** Each batch colour as a gradient chip, a soft background and a dot. */
export const BATCH_COLORS: Record<BatchColor, { tile: string; soft: string; dot: string; label: string }> = {
  violet: { tile: "from-violet-500 to-indigo-500", soft: "bg-violet-500/10 text-violet-600 dark:text-violet-300", dot: "bg-violet-500", label: "Violet" },
  blue: { tile: "from-sky-500 to-blue-600", soft: "bg-blue-500/10 text-blue-600 dark:text-blue-300", dot: "bg-blue-500", label: "Blue" },
  pink: { tile: "from-pink-500 to-fuchsia-500", soft: "bg-pink-500/10 text-pink-600 dark:text-pink-300", dot: "bg-pink-500", label: "Pink" },
  amber: { tile: "from-amber-400 to-orange-500", soft: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500", label: "Amber" },
  emerald: { tile: "from-emerald-400 to-teal-500", soft: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", label: "Green" },
  cyan: { tile: "from-cyan-400 to-sky-500", soft: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500", label: "Cyan" },
  rose: { tile: "from-rose-500 to-red-500", soft: "bg-rose-500/10 text-rose-600 dark:text-rose-300", dot: "bg-rose-500", label: "Red" },
  slate: { tile: "from-slate-500 to-slate-700", soft: "bg-slate-500/10 text-slate-600 dark:text-slate-300", dot: "bg-slate-500", label: "Grey" },
};

export const batchColor = (c?: string) => BATCH_COLORS[(c as BatchColor) ?? "violet"] ?? BATCH_COLORS.violet;
