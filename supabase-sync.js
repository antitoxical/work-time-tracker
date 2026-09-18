import { $ } from "./utils.js";
import { syncFromSupabase } from "./storage.js";
import { renderAll } from "./render.js";
import {
  isConfigured,
  getSyncCode,
  setSyncCode,
  loadSyncCode,
  generateSyncCode
} from "./supabase.js";

function msg(text, isError) {
  const el = $("syncMessage");
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "var(--danger-text)" : "var(--success)";
}

function updateUI() {
  const code = getSyncCode();
  const statusEl = $("syncStatus");
  const codeDisplay = $("syncCodeDisplay");
  const codeInput = $("syncCodeInput");
  const connectBtn = $("syncConnect");
  const disconnectBtn = $("syncDisconnect");
  const generateBtn = $("syncGenerate");
  const copyBtn = $("syncCopy");

  if (!isConfigured()) {
    if (statusEl) statusEl.textContent = "Supabase не настроен в конфиге";
    return;
  }

  if (code) {
    if (statusEl) {
      statusEl.textContent = "Синхронизация включена";
      statusEl.className = "sync-status connected";
    }
    if (codeDisplay) {
      codeDisplay.style.display = "";
      codeDisplay.querySelector("code").textContent = code;
    }
    if (codeInput) codeInput.style.display = "none";
    if (connectBtn) connectBtn.style.display = "none";
    if (generateBtn) generateBtn.style.display = "none";
    if (disconnectBtn) disconnectBtn.style.display = "";
    if (copyBtn) copyBtn.style.display = "";
  } else {
    if (statusEl) {
      statusEl.textContent = "Синхронизация не активна";
      statusEl.className = "sync-status disconnected";
    }
    if (codeDisplay) codeDisplay.style.display = "none";
    if (codeInput) codeInput.style.display = "";
    if (connectBtn) connectBtn.style.display = "";
    if (generateBtn) generateBtn.style.display = "";
    if (disconnectBtn) disconnectBtn.style.display = "none";
    if (copyBtn) copyBtn.style.display = "none";
  }
}

export function setupSupabaseSync() {
  const savedCode = loadSyncCode();

  if (savedCode) {
    msg("Синхронизация...");
    syncFromSupabase().then(changed => {
      if (changed) {
        renderAll();
        msg("Данные загружены", false);
      } else {
        msg("");
      }
      updateUI();
    });
  } else {
    updateUI();
  }

  $("syncConnect").onclick = async () => {
    const code = $("syncCodeInput").value.trim().toLowerCase();
    if (!code || code.length < 4) {
      msg("Введите код (минимум 4 символа)", true);
      return;
    }

    setSyncCode(code);
    msg("Подключение...");

    const changed = await syncFromSupabase();
    if (changed) renderAll();

    msg("Подключено!", false);
    $("syncCodeInput").value = "";
    updateUI();
  };

  $("syncGenerate").onclick = async () => {
    const code = generateSyncCode();
    setSyncCode(code);

    msg("Создание нового кода...");
    await syncFromSupabase();

    msg("Новый код создан. Данные будут синхронизированы при первом изменении.", false);
    updateUI();
  };

  $("syncDisconnect").onclick = () => {
    setSyncCode(null);
    msg("Синхронизация отключена", false);
    updateUI();
  };

  $("syncCopy").onclick = () => {
    const code = getSyncCode();
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        msg("Код скопирован!", false);
        setTimeout(() => msg(""), 2000);
      });
    }
  };
}