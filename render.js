import { $, pad, fmt, signed, fmtTimer, displayTime } from "./utils.js";
import { getData, getSettings } from "./storage.js";
import { today, minBetween, periodBounds, inBounds } from "./time.js";
import {
  normalize,
  liveNormalized,
  liveTimerSeconds,
  lunchTotalSeconds,
  requiredMinutes
} from "./normalize.js";

let month = today().slice(0, 7);

export function getMonth() {
  return month;
}

export function setMonth(m) {
  month = m;
}

export function active() {
  return getData().find(
    x =>
      x &&
      x.active === true &&
      (
        (Array.isArray(x.intervals) &&
          x.intervals.some(i => i?.start && !i?.end)) ||
        (x.onLunch === true &&
          typeof x.lunchStart === "string" &&
          x.lunchStart)
      )
  );
}

export function doneToday() {
  return getData().find(
    x => x.date === today() && !x.active
  );
}

function todayEntry() {
  return active() || doneToday();
}

function updateLunchView(e) {
  const el = $("lunchView");
  if (!el) return;

  if (e) {
    const total = lunchTotalSeconds(e);
    const m = Math.floor(total / 60);
    el.textContent = `${pad(Math.floor(m / 60))}ч ${pad(m % 60)}м`;
  } else {
    el.textContent = "0ч 00м";
  }
}

function updateLunchTime(e) {
  if (!e) return;

  const container = $("todayIntervals");
  if (!container) return;

  const existing = container.querySelector(".lunch-time");
  const lunchSec = lunchTotalSeconds(e);

  if (lunchSec <= 0) {
    if (existing) existing.remove();
    return;
  }

  const total = Math.floor(lunchSec / 60);
  const text =
    `Время на обеде: ${pad(Math.floor(total / 60))}ч ${pad(total % 60)}м`;

  if (existing) {
    existing.textContent = text;
  } else {
    const div = document.createElement("div");
    div.className = "lunch-time";
    div.textContent = text;
    container.appendChild(div);
  }
}

export function renderToday() {
  const settings = getSettings();
  const e = todayEntry();
  const a = active();

  $("todayText").textContent =
    new Date().toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });

  $("startView").textContent = e ? normalize(e).start : "—";
  $("normView").textContent = fmt(settings.norm);

  if (a) {
    const n = liveNormalized(a);

    $("statusBadge").textContent = a.onLunch ? "На обеде" : "Работаю";
    $("timerCaption").textContent = a.onLunch ? "Обед идёт" : "Рабочий день идёт";
    $("startBtn").disabled = true;
    $("startBtn").textContent = "▶ Начать работу";
    $("lunchBtn").disabled = false;
    $("finishBtn").disabled = false;
    $("lunchBtn").textContent = a.onLunch ? "▶ Продолжить работу" : "☕ Начать обед";
    $("timer").textContent = fmtTimer(liveTimerSeconds(a));
    $("grossView").textContent = fmt(n.gross);
    $("netView").textContent = fmt(n.net);
    updateLunchView(a);
    $("balanceView").textContent = signed(n.net - settings.norm);

  } else if (e) {
    const n = normalize(e);

    $("statusBadge").textContent = "День завершён";
    $("timerCaption").textContent = "Рабочий день завершён";
    $("startBtn").disabled = false;
    $("startBtn").textContent = "▶ Продолжить работу";
    $("lunchBtn").disabled = true;
    $("finishBtn").disabled = true;
    $("timer").textContent = fmtTimer(liveTimerSeconds(e));
    $("grossView").textContent = fmt(n.gross);
    $("netView").textContent = fmt(n.net);
    updateLunchView(e);
    $("balanceView").textContent = signed(n.balance);

  } else {
    $("statusBadge").textContent = "Не работаю";
    $("timerCaption").textContent = "Сегодня ещё не начинал работу";
    $("startBtn").disabled = false;
    $("startBtn").textContent = "▶ Начать работу";
    $("lunchBtn").disabled = true;
    $("finishBtn").disabled = true;
    $("timer").textContent = "00:00:00";
    $("grossView").textContent = "0ч 00м";
    $("netView").textContent = "0ч 00м";
    updateLunchView(null);
    $("balanceView").textContent = signed(-settings.norm);
  }

  renderIntervals();
}

function renderIntervals() {
  const e = todayEntry();
  const box = $("todayIntervals");

  if (!e) {
    box.innerHTML = "";
    $("todayEmpty").style.display = "block";
    return;
  }

  $("todayEmpty").style.display = "none";

  const ints = e.intervals || [];
  const items = [];
  let lunchAdded = false;

  for (let n = 0; n < ints.length; n++) {
    const iv = ints[n];
    const endTime = iv.end ? displayTime(iv.end) : "сейчас";
    const dur = iv.end
      ? fmt(minBetween(iv.start, iv.end, e.date))
      : (e.onLunch ? "—" : "Идёт");

    items.push(
      `<div class="interval-item">
        <div>
          <b>Работа</b>
          <small>${displayTime(iv.start)} — ${endTime}</small>
        </div>
        <b>${dur}</b>
      </div>`
    );

    const next = ints[n + 1];
    if (next && iv.end) {
      const gapStart = iv.end;
      const gapEnd = next.start;

      const isLunch =
        (e.lunchStart &&
          displayTime(gapStart) === displayTime(e.lunchStart)) ||
        (!e.lunchStart && e.lunch > 0 && !lunchAdded);

      if (isLunch) {
        lunchAdded = true;
        items.push(
          `<div class="interval-item">
            <div>
              <b>Обед</b>
              <small>${displayTime(gapStart)} — ${displayTime(gapEnd)}</small>
            </div>
            <b>${fmt(minBetween(gapStart, gapEnd, e.date))}</b>
          </div>`
        );
      }
    }
  }

  if (e.onLunch && !lunchAdded) {
    items.push(
      `<div class="interval-item">
        <div>
          <b>Обед</b>
          <small>${displayTime(e.lunchStart)} — сейчас</small>
        </div>
        <b>Идёт</b>
      </div>`
    );
  }

  box.innerHTML = items.join("");
  updateLunchTime(e);
}

export function renderTable() {
  const list = getData()
    .filter(e => e.date?.startsWith(month) && !e.active)
    .map(normalize)
    .sort((a, b) => b.date.localeCompare(a.date));

  $("empty").style.display = list.length ? "none" : "block";

  $("rows").innerHTML =
    list.map(e =>
      `<tr>
        <td>${e.date.split("-").reverse().join(".")}</td>
        <td>${e.start}</td>
        <td>${e.end}</td>
        <td>${fmt(e.lunch)}</td>
        <td>${fmt(e.gross)}</td>
        <td class="net">${fmt(e.net)}</td>
        <td>${signed(e.balance)}</td>
        <td>
          <button class="ghost edit" data-id="${e.id}">✎</button>
          <button class="ghost del" data-id="${e.id}">✕</button>
        </td>
      </tr>`
    ).join("");

  return list;
}

export function renderStats() {
  const settings = getSettings();
  const [a, b] = periodBounds($("period").value);

  const list = getData()
    .filter(e => !e.active && inBounds(e.date, a, b))
    .map(normalize);

  const net = list.reduce((s, e) => s + e.net, 0);
  const req = requiredMinutes(a, b);

  $("sDays").textContent = list.length;
  $("sNet").textContent = fmt(net);
  $("sAvg").textContent = fmt(list.length ? net / list.length : 0);
  $("sBalance").textContent = signed(net - req);
  $("requiredNorm").textContent = fmt(req);
  $("requiredNormHint").textContent =
    `Календарная норма: ${settings.workDays.length} рабочих дней в неделю`;

  drawChart(list);
}

function drawChart(list) {
  const settings = getSettings();
  const c = $("chart");
  const ctx = c.getContext("2d");
  const w = c.clientWidth;
  const h = c.clientHeight;
  const dpr = devicePixelRatio || 1;

  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  if (!list.length) {
    ctx.fillStyle = "var(--text-muted, #9ca3af)";
    ctx.textAlign = "center";
    ctx.font = "14px sans-serif";
    ctx.fillText("Нет данных для графика", w / 2, h / 2);
    return;
  }

  const max = Math.max(settings.norm, ...list.map(e => e.net), 60);
  const px = 30;
  const py = 20;
  const base = h - 35;
  const uw = w - px * 2;
  const step = uw / list.length;

  const style = getComputedStyle(document.documentElement);
  const barColor = style.getPropertyValue("--accent").trim() || "#111827";
  const textColor = style.getPropertyValue("--text-secondary").trim() || "#6b7280";
  const lineColor = style.getPropertyValue("--text-muted").trim() || "#9ca3af";

  list.forEach((e, i) => {
    const bh = e.net / max * (h - py - 55);
    const x = px + i * step + step * 0.2;
    const bw = Math.max(8, step * 0.6);

    ctx.fillStyle = barColor;
    ctx.fillRect(x, base - bh, bw, bh);

    ctx.fillStyle = textColor;
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(e.date.slice(8), x + bw / 2, base + 17);
  });

  const ny = base - settings.norm / max * (h - py - 55);

  ctx.strokeStyle = lineColor;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(px, ny);
  ctx.lineTo(w - px, ny);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function renderAll() {
  $("monthPicker").value = month;
  renderToday();
  renderTable();

  if ($("statsScreen").classList.contains("active")) {
    renderStats();
  }
}

export function tick() {
  const a = active();
  const e = todayEntry();

  if (a) {
    const n = liveNormalized(a);

    $("timer").textContent = fmtTimer(liveTimerSeconds(a));
    $("grossView").textContent = fmt(n.gross);
    $("netView").textContent = fmt(n.net);
    updateLunchView(a);
    updateLunchTime(a);
    $("balanceView").textContent = signed(n.net - getSettings().norm);
    return;
  }

  if (e) {
    $("timer").textContent = fmtTimer(liveTimerSeconds(e));
    updateLunchTime(e);
    return;
  }

  $("timer").textContent = "00:00:00";
}