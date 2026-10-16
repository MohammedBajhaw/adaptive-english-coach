import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Installed web app: offline support. Only in production builds (the dev server has no sw.js).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}

// After a new deploy, an old tab can ask for a lazy chunk that no longer exists: reload once to get the new version.
window.addEventListener("vite:preloadError", () => {
  try {
    if (sessionStorage.getItem("aec.preload-reload")) return;
    sessionStorage.setItem("aec.preload-reload", "1");
  } catch { /* storage unavailable */ }
  window.location.reload();
});
