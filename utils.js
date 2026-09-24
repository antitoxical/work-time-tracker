export function pad(n) {
  return String(n).padStart(2, "0");
}

export function displayTime(t) {
  if (!t) return "—";
  const s = String(t);
  return s.includes("T") ? s.split("T")[1] : s;
}

export function timeInputValue(t) {
  const s = displayTime(t);
  return !s || s === "—" ? "" : s.slice(0, 5);
}

export function withSeconds(hm) {
  const parts = String(hm || "").split(":");
  if (parts.length >= 3) return `${pad(parts[0])}:${pad(parts[1])}:${pad(parts[2])}`;
  if (parts.length === 2) return `${pad(parts[0])}:${pad(parts[1])}:00`;
  return "";
}

export function combineStamp(date, hm) {
  const time = withSeconds(hm);
  return date && time ? `${date}T${time}` : time;
}

export function fmt(x) {
  x = Math.max(0, Math.round(x));
  return `${Math.floor(x / 60)}:${pad(x % 60)}`;
}

export function signed(x) {
  const sign = x < 0 ? "−" : "+";
  x = Math.abs(Math.round(x));
  return `${sign}${Math.floor(x / 60)}:${pad(x % 60)}`;
}

export function fmtHuman(minutes) {
  minutes = Math.max(0, Math.round(minutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h === 0 && m === 0) return "0 минут";
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;

  return `${h} ч ${m} мин`;
}

export function fmtTimer(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export const $ = id => document.getElementById(id);