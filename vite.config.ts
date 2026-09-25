import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Development: `npm run dev` here, and the backend on :3000 — /api is proxied
// to it, so no CORS setup is needed locally.
// Production (Vercel): set VITE_API_URL to the Render backend's address.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": process.env.API_PROXY_TARGET || "http://localhost:3000" },
  },
  build: { chunkSizeWarningLimit: 1500 },
});
