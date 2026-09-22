import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": "http://127.0.0.1:8010" }, // dev only; nginx does this in prod
    // Lets a `cloudflared tunnel` quick-tunnel (random *.trycloudflare.com host each run) through
    // Vite's dev-server host check. Dev-only; production is served by nginx, not this dev server.
    allowedHosts: [".trycloudflare.com"],
  },
});
