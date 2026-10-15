import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "adaptive-english-coach";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  // client/public only holds the Manus dev debug collector, which the static site must not ship.
  publicDir: false,
  base: process.env.GITHUB_PAGES === "true" ? `/${repository}/` : "/",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/github-pages"),
    emptyOutDir: true,
  },
});
