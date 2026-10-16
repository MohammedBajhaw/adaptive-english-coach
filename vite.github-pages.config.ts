import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import { defineConfig, type Plugin } from "vite";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "adaptive-english-coach";

// Emits sw.js with the list of built files so the whole app works offline once installed.
function offlineServiceWorker(): Plugin {
  const buildId = Date.now().toString(36);
  return {
    name: "offline-service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter(file => !file.endsWith(".map"));
      const template = fs.readFileSync(path.resolve(import.meta.dirname, "client", "sw.template.js"), "utf8");
      const precache = ["./", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", ...files];
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: template.replaceAll("__BUILD_ID__", buildId).replaceAll("__PRECACHE__", JSON.stringify(precache)),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), offlineServiceWorker()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  base: process.env.GITHUB_PAGES === "true" ? `/${repository}/` : "/",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/github-pages"),
    emptyOutDir: true,
  },
});
