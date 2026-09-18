import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const SYNC_CODE_KEY = "workTimeSyncCode";

let client = null;
let syncCode = null;

function getClient() {
  if (client) return client;
  if (!window.supabase || !SUPABASE_URL.startsWith("https://")) return null;
  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export function isConfigured() {
  return !!(window.supabase && SUPABASE_URL.startsWith("https://"));
}

export function getSyncCode() {
  return syncCode;
}

export function setSyncCode(code) {
  syncCode = code ? code.trim().toLowerCase() : null;
  if (syncCode) {
    localStorage.setItem(SYNC_CODE_KEY, syncCode);
  } else {
    localStorage.removeItem(SYNC_CODE_KEY);
  }
}

export function loadSyncCode() {
  syncCode = localStorage.getItem(SYNC_CODE_KEY) || null;
  return syncCode;
}

export function generateSyncCode() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function syncDown() {
  const sb = getClient();
  if (!sb || !syncCode) return null;

  try {
    const { data, error } = await sb
      .from("tracker_sync")
      .select("payload")
      .eq("sync_code", syncCode)
      .maybeSingle();

    if (error) {
      console.warn("Supabase syncDown:", error);
      return null;
    }

    return data?.payload || null;
  } catch (e) {
    console.warn("Supabase syncDown exception:", e);
    return null;
  }
}

export async function syncUp(payload) {
  const sb = getClient();
  if (!sb || !syncCode) return;

  try {
    await sb
      .from("tracker_sync")
      .upsert(
        { sync_code: syncCode, payload, updated_at: new Date().toISOString() },
        { onConflict: "sync_code" }
      );
  } catch (e) {
    console.warn("Supabase syncUp exception:", e);
  }
}