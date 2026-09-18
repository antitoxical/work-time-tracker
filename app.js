import { renderAll, renderToday, renderTable, tick } from "./render.js";
import { fixStaleActive, setupHandlers } from "./handlers.js";
import { initTheme } from "./theme.js";

initTheme();
fixStaleActive();
setupHandlers();
renderAll();
tick();

setInterval(tick, 1000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .catch(() => {});
}