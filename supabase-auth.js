import { $ } from "./utils.js";
import { syncFromSupabase, setData, getData, save } from "./storage.js";
import { renderAll } from "./render.js";
import {
  isConfigured,
  setConfig,
  clearConfig,
  initSupabase,
  signIn,
  signUp,
  signOut,
  getUserId
} from "./supabase.js";

function renderCalendarGrid() {
  if (window._renderCalendarGrid) window._renderCalendarGrid();
}

function msg(text, isError) {
  const el = $("authMessage");
  el.textContent = text;
  el.style.color = isError ? "var(--danger-text)" : "var(--success)";
}

function updateUI() {
  const configDiv = $("supabaseConfig");
  const authDiv = $("authSection");
  const statusEl = $("authStatus");
  const formEl = $("authForm");
  const actionsEl = $("authActions");

  if (!isConfigured()) {
    configDiv.style.display = "";
    authDiv.style.display = "none";
    return;
  }

  configDiv.style.display = "none";
  authDiv.style.display = "";

  if (getUserId()) {
    statusEl.textContent = "✓ Синхронизация включена";
    statusEl.className = "auth-status connected";
    formEl.style.display = "none";
    actionsEl.style.display = "";
  } else {
    statusEl.textContent = "Не авторизован";
    statusEl.className = "auth-status disconnected";
    formEl.style.display = "";
    actionsEl.style.display = "none";
  }
}

async function handleAuthChange(uid) {
  if (uid) {
    msg("Синхронизация данных...");
    const changed = await syncFromSupabase();
    if (changed) {
      renderAll();
      renderCalendarGrid();
      msg("Данные синхронизированы", false);
    } else {
      save();
      msg("");
    }
  }
  updateUI();
}

export function setupSupabaseAuth() {
  const { url, key } = {
    url: localStorage.getItem("workTimeSupabaseUrl") || "",
    key: localStorage.getItem("workTimeSupabaseKey") || ""
  };

  if (url && key) {
    $("sbUrl").value = url;
    $("sbKey").value = key;
  }

  $("sbSaveConfig").onclick = async () => {
    const url = $("sbUrl").value.trim();
    const key = $("sbKey").value.trim();

    if (!url || !key) {
      msg("Заполните оба поля", true);
      return;
    }

    setConfig(url, key);
    msg("Подключение...");

    const uid = await initSupabase(handleAuthChange);

    if (uid) {
      msg("Синхронизация данных...");
      const changed = await syncFromSupabase();
      if (changed) { renderAll(); renderCalendarGrid(); }
      msg("Подключено и синхронизировано", false);
    } else {
      msg("Подключено. Войдите для синхронизации.", false);
    }

    updateUI();
  };

  $("authSignIn").onclick = async () => {
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;

    if (!email || !password) {
      msg("Введите email и пароль", true);
      return;
    }

    msg("Вход...");
    const result = await signIn(email, password);

    if (result.error) {
      msg(result.error, true);
    } else {
      msg("");
      $("authPassword").value = "";
    }
  };

  $("authSignUp").onclick = async () => {
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;

    if (!email || !password) {
      msg("Введите email и пароль", true);
      return;
    }

    if (password.length < 6) {
      msg("Пароль должен быть не менее 6 символов", true);
      return;
    }

    msg("Регистрация...");
    const result = await signUp(email, password);

    if (result.error) {
      msg(result.error, true);
    } else if (result.needsConfirm) {
      msg("Проверьте email для подтверждения", false);
    } else {
      msg("");
      $("authPassword").value = "";
    }
  };

  $("authSignOut").onclick = async () => {
    await signOut();
    clearConfig();
    $("sbUrl").value = "";
    $("sbKey").value = "";
    $("authPassword").value = "";
    msg("");
    updateUI();
  };

  if (isConfigured()) {
    initSupabase(handleAuthChange).then(uid => {
      if (uid) {
        syncFromSupabase().then(changed => {
          if (changed) { renderAll(); renderCalendarGrid(); }
          updateUI();
        });
      } else {
        updateUI();
      }
    });
  } else {
    updateUI();
  }
}