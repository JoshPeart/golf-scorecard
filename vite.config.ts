import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, ".", "").VITE_BASE || "/",
  plugins: [react()],
  preview: { allowedHosts: [".devinapps.com", "localhost"] },
}));
