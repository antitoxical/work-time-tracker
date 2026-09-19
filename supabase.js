const SB_URL_KEY = "workTimeSupabaseUrl";
const SB_KEY_KEY = "workTimeSupabaseKey";

let client = null;
let userId = null;

function getConfig() {
  return {
    url: localStorage.getItem(SB_URL_KEY) || "",
    key: localStorage.getItem(SB_KEY_KEY) || ""
  };
}

export function setConfig(url, key) {
  localStorage.setItem(SB_URL_KEY, url);
  localStorage.setItem(SB_KEY_KEY, key);
}

export function clearConfig() {
  localStorage.removeItem(SB_URL_KEY);
  localStorage.removeItem(SB_KEY_KEY);
  client = null;
  userId = null;
}

export function isConfigured() {
  const { url, key } = getConfig();
  return !!(url && key && window.supabase);
}

function getClient() {
  if (client) return client;
  const { url, key } = getConfig();
  if (!url || !key || !window.supabase) return null;
  client = window.supabase.createClient(url, key);
  return client;
}

export function getUserId() {
  return userId;
}

export async function initSupabase(onAuthChange) {
  if (!isConfigured()) return null;

  const sb = getClient();
  if (!sb) return null;

  const { data: { session } } = await sb.auth.getSession();
  userId = session?.user?.id || null;

  sb.auth.onAuthStateChange((_event, session) => {
    userId = session?.user?.id || null;
    if (onAuthChange) onAuthChange(userId);
  });

  return userId;
}

export async function signIn(email, password) {
  const sb = getClient();
  if (!sb) return { error: "Supabase не настроен" };

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  userId = data.user?.id || null;
  return { user: data.user };
}

export async function signUp(email, password) {
  const sb = getClient();
  if (!sb) return { error: "Supabase не настроен" };

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
  if (error) return { error: error.message };

  userId = data.user?.id || null;
  return { user: data.user, needsConfirm: !data.session };
}

export async function signOut() {
  const sb = getClient();
  if (!sb) return;
  await sb.auth.signOut();
  userId = null;
}

export async function syncDown() {
  const sb = getClient();
  if (!sb || !userId) return null;

  try {
    const { data, error } = await sb
      .from("tracker_sync")
      .select("payload")
      .eq("sync_code", userId)
      .maybeSingle();

    if (error) {
      console.warn("Supabase syncDown error:", error);
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
  if (!sb || !userId) return;

  try {
    await sb
      .from("tracker_sync")
      .upsert(
        { sync_code: userId, payload, updated_at: new Date().toISOString() },
        { onConflict: "sync_code" }
      );
  } catch (e) {
    console.warn("Supabase syncUp exception:", e);
  }
}