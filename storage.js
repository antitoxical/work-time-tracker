import { isConfigured, getUserId, syncDown, syncUp } from "./supabase.js";

const KEY = "workTimeTrackerV3";
const SETTINGS = "workTimeSettingsV3";

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

let data = readJSON(KEY, []);
let settings = readJSON(SETTINGS, {
  norm: 480,
  workDays: [1, 2, 3, 4, 5]
});

if (!Array.isArray(settings.workDays) || !settings.workDays.length) {
  settings.workDays = [1, 2, 3, 4, 5];
}
if (!Number.isFinite(settings.norm) || settings.norm < 0) {
  settings.norm = 480;
}

export function getData() {
  return data;
}

export function setData(newData) {
  data = newData;
}

export function getSettings() {
  return settings;
}

export function setSettings(newSettings) {
  settings = newSettings;
  try {
    localStorage.setItem(SETTINGS, JSON.stringify(settings));
  } catch {
    alert("Не удалось сохранить настройки.");
  }
  if (isConfigured() && getUserId()) {
    syncUp({ records: data, settings });
  }
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    alert("Не удалось сохранить данные. Возможно, хранилище заполнено.");
  }
  if (isConfigured() && getUserId()) {
    syncUp({ records: data, settings });
  }
}

export async function syncFromSupabase() {
  if (!isConfigured() || !getUserId()) return false;

  const payload = await syncDown();
  if (!payload) return false;

  if (Array.isArray(payload.records)) {
    data = payload.records;
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  if (payload.settings && typeof payload.settings === "object") {
    settings = {
      norm: Number.isFinite(payload.settings.norm) ? payload.settings.norm : 480,
      workDays: Array.isArray(payload.settings.workDays) && payload.settings.workDays.length
        ? payload.settings.workDays
        : [1, 2, 3, 4, 5]
    };
    localStorage.setItem(SETTINGS, JSON.stringify(settings));
  }

  return true;
}