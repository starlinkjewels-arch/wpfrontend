// Runs before the app renders, so a dark-mode user never sees a white flash.
// The choice is stored as JSON by lib/storage ("\"dark\"").
try {
  const saved = JSON.parse(localStorage.getItem("sl.theme") ?? "null") as string | null;
  const dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}
