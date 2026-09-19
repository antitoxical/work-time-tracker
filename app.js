import { renderAll, tick } from "./render.js";
import { fixStaleActive, setupHandlers } from "./handlers.js";
import { initTheme } from "./theme.js";
import { setupSupabaseAuth } from "./supabase-auth.js";
import { initCalendarView, renderCalendarGrid } from "./calendar-view.js";

console.log("[app] v9 loaded");

window._renderCalendarGrid = renderCalendarGrid;

initTheme();
fixStaleActive();
setupHandlers();
initCalendarView();
renderAll();
tick();
setupSupabaseAuth();

setInterval(tick, 1000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .then(reg => {
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (sw) sw.addEventListener("statechange", () => {
          if (sw.state === "activated") window.location.reload();
        });
      });
    })
    .catch(() => {});
}