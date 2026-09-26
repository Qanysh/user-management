import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    // Allow access through nginx reverse proxy
    allowedHosts: true,
    // HMR websocket through nginx on host :8080
    hmr: {
      clientPort: 8080,
    },
  },
});
