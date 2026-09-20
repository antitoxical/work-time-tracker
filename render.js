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
    el.textContent = fmt(m);
  } else {
    el.textContent = fmt(0);
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

  $("startView").textContent = e ? normalize(e).start.slice(0, 5) : "—";
  $("normView").textContent = fmt(settings.norm);

  if (a) {
    const n = liveNormalized(a);

    $("statusBadge").textContent = a.onLunch ? "На обеде" : "Работаю";
    $("statusBadge").className = `badge ${a.onLunch ? "lunch" : "working"}`;
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
    $("statusBadge").className = "badge done";
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
    $("statusBadge").className = "badge";
    $("timerCaption").textContent = "Сегодня ещё не начинал работу";
    $("startBtn").disabled = false;
    $("startBtn").textContent = "▶ Начать работу";
    $("lunchBtn").disabled = true;
    $("finishBtn").disabled = true;
    $("timer").textContent = "00:00:00";
    $("grossView").textContent = fmt(0);
    $("netView").textContent = fmt(0);
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
    const endTime = iv.end ? displayTime(iv.end).slice(0, 5) : "сейчас";
    const dur = iv.end
      ? fmt(minBetween(iv.start, iv.end, e.date))
      : (e.onLunch ? "—" : "Идёт");

    items.push(
      `<div class="interval-item">
        <div>
          <b>Работа</b>
          <small>${displayTime(iv.start).slice(0, 5)} — ${endTime}</small>
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
              <small>${displayTime(gapStart).slice(0, 5)} — ${displayTime(gapEnd).slice(0, 5)}</small>
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
          <small>${displayTime(e.lunchStart).slice(0, 5)} — сейчас</small>
        </div>
        <b>Идёт</b>
      </div>`
    );
  }

  box.innerHTML = items.join("");
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

  const style = getComputedStyle(document.documentElement);
  const accentSolid = style.getPropertyValue("--accent").trim() || "#007aff";
  const textColor = style.getPropertyValue("--text-secondary").trim() || "rgba(255,255,255,0.55)";
  const lineColor = style.getPropertyValue("--text-muted").trim() || "rgba(255,255,255,0.3)";

  if (!list.length) {
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText("Нет данных для графика", w / 2, h / 2);
    return;
  }

  const max = Math.max(settings.norm, ...list.map(e => e.net), 60);
  const px = 30;
  const py = 20;
  const base = h - 35;
  const uw = w - px * 2;
  const step = uw / list.length;

  const barGrad = ctx.createLinearGradient(0, base, 0, base - (h - py - 55));
  barGrad.addColorStop(0, accentSolid);
  barGrad.addColorStop(1, accentSolid + "88");

  list.forEach((e, i) => {
    const bh = e.net / max * (h - py - 55);
    const x = px + i * step + step * 0.2;
    const bw = Math.max(8, step * 0.6);

    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect(x, base - bh, bw, bh, 4);
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(e.date.slice(8), x + bw / 2, base + 17);
  });

  const ny = base - settings.norm / max * (h - py - 55);

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(px, ny);
  ctx.lineTo(w - px, ny);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function renderAll() {
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
    $("balanceView").textContent = signed(n.net - getSettings().norm);
    return;
  }

  if (e) {
    $("timer").textContent = fmtTimer(liveTimerSeconds(e));
    return;
  }

  $("timer").textContent = "00:00:00";
}