import { pad } from "./utils.js";

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today() {
  return dateKey();
}

export function currentMonth() {
  return today().slice(0, 7);
}

function nowHMSS(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function stamp(d = new Date()) {
  return `${dateKey(d)}T${nowHMSS(d)}`;
}

export function parseStamp(t, fallbackDate) {
  if (typeof t !== "string" || !t) return NaN;

  if (t.includes("T")) {
    const d = new Date(t);
    return d.getTime();
  }

  const p = t.split(":").map(Number);

  if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return NaN;
  if (p[0] < 0 || p[0] > 23 || p[1] < 0 || p[1] > 59) return NaN;

  const sec = Number.isFinite(p[2]) ? p[2] : 0;
  if (sec < 0 || sec > 59) return NaN;

  const base = fallbackDate
    ? new Date(`${fallbackDate}T12:00:00`)
    : new Date();

  const d = new Date(base);
  d.setHours(p[0], p[1], sec, 0);
  return d.getTime();
}

export function parseTimeToSec(t) {
  const ms = parseStamp(t);
  if (!Number.isFinite(ms)) return NaN;

  if (String(t).includes("T")) {
    const d = new Date(ms);
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  }

  const p = t.split(":").map(Number);
  return p[0] * 3600 + p[1] * 60 + (Number.isFinite(p[2]) ? p[2] : 0);
}

export function diffSec(a, b, dateHint) {
  const start = parseStamp(a, dateHint);
  const end = parseStamp(b, dateHint);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;

  let diff = Math.floor((end - start) / 1000);
  if (diff < 0) diff += 86400;

  return diff;
}

export function minBetween(a, b, dateHint) {
  return Math.round(diffSec(a, b, dateHint) / 60);
}

export function elapsedFromStart(start, now = new Date()) {
  const startMs = parseStamp(start);
  if (!Number.isFinite(startMs)) return 0;

  let diff = now.getTime() - startMs;
  if (diff < 0 && !String(start).includes("T")) diff += 86400000;

  return Math.max(0, Math.floor(diff / 1000));
}

export function periodBounds(type) {
  const t = new Date(today() + "T12:00:00");

  if (type === "day") return [new Date(t), new Date(t)];

  if (type === "week") {
    const n = t.getDay() || 7;
    const a = new Date(t);
    a.setDate(t.getDate() - n + 1);
    const b = new Date(a);
    b.setDate(a.getDate() + 6);
    return [a, b];
  }

  if (type === "month") {
    return [
      new Date(t.getFullYear(), t.getMonth(), 1),
      new Date(t.getFullYear(), t.getMonth() + 1, 0)
    ];
  }

  return [
    new Date(t.getFullYear(), 0, 1),
    new Date(t.getFullYear(), 11, 31)
  ];
}

export function inBounds(date, a, b) {
  const d = new Date(date + "T12:00:00");
  return d >= a && d <= b;
}