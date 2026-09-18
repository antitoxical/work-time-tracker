import { renderAll, tick } from "./render.js";
import { fixStaleActive, setupHandlers } from "./handlers.js";
import { initTheme } from "./theme.js";
import { setupSupabaseSync } from "./supabase-sync.js";

initTheme();
fixStaleActive();
setupHandlers();
renderAll();
tick();
setupSupabaseSync();

setInterval(tick, 1000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .catch(() => {});
}