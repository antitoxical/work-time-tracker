const KEY = "workTimeTrackerV3";
const SETTINGS = "workTimeSettingsV3";

function pad(n) {
  return String(n).padStart(2, "0");
}

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
let month = currentMonth();

const $ = id => document.getElementById(id);

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function today() {
  return dateKey();
}

function currentMonth() {
  return today().slice(0, 7);
}

function nowHMSS(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function stamp(d = new Date()) {
  return `${dateKey(d)}T${nowHMSS(d)}`;
}

function withSeconds(hm) {
  const parts = String(hm || "").split(":");
  if (parts.length >= 3) return `${pad(parts[0])}:${pad(parts[1])}:${pad(parts[2])}`;
  if (parts.length === 2) return `${pad(parts[0])}:${pad(parts[1])}:00`;
  return "";
}

function combineStamp(date, hm) {
  const time = withSeconds(hm);
  return date && time ? `${date}T${time}` : time;
}

function displayTime(t) {
  if (!t) return "—";
  const s = String(t);
  return s.includes("T") ? s.split("T")[1] : s;
}

function timeInputValue(t) {
  const s = displayTime(t);
  return !s || s === "—" ? "" : s.slice(0, 5);
}

function parseStamp(t, fallbackDate) {
  if (typeof t !== "string" || !t) return NaN;

  if (t.includes("T")) {
    const d = new Date(t);
    return d.getTime();
  }

  const p = t.split(":").map(Number);

  if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
    return NaN;
  }

  if (p[0] < 0 || p[0] > 23 || p[1] < 0 || p[1] > 59) {
    return NaN;
  }

  const sec = Number.isFinite(p[2]) ? p[2] : 0;

  if (sec < 0 || sec > 59) {
    return NaN;
  }

  const base = fallbackDate
    ? new Date(`${fallbackDate}T12:00:00`)
    : new Date();

  const d = new Date(base);
  d.setHours(p[0], p[1], sec, 0);
  return d.getTime();
}

function parseTimeToSec(t) {
  const ms = parseStamp(t);
  if (!Number.isFinite(ms)) return NaN;

  if (String(t).includes("T")) {
    const d = new Date(ms);
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  }

  const p = t.split(":").map(Number);
  return p[0] * 3600 + p[1] * 60 + (Number.isFinite(p[2]) ? p[2] : 0);
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    alert("Не удалось сохранить данные. Возможно, хранилище заполнено.");
  }
}

function diffSec(a, b, dateHint) {
  const start = parseStamp(a, dateHint);
  const end = parseStamp(b, dateHint);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }

  let diff = Math.floor((end - start) / 1000);

  if (diff < 0) {
    diff += 86400;
  }

  return diff;
}

function minBetween(a, b, dateHint) {
  return Math.round(diffSec(a, b, dateHint) / 60);
}

function fmt(x) {
  x = Math.max(0, Math.round(x));
  return `${Math.floor(x / 60)}ч ${pad(x % 60)}м`;
}

function signed(x) {
  const s = x < 0 ? "−" : "+";
  x = Math.abs(Math.round(x));

  return `${s}${Math.floor(x / 60)}ч ${pad(x % 60)}м`;
}

function fmtTimer(seconds) {
  seconds = Math.max(0, Math.floor(seconds));

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function elapsedFromStart(start, now = new Date()) {
  const startMs = parseStamp(start);

  if (!Number.isFinite(startMs)) {
    return 0;
  }

  let diff = now.getTime() - startMs;

  // Старые записи без даты: переход через полночь.
  if (diff < 0 && !String(start).includes("T")) {
    diff += 86400000;
  }

  return Math.max(0, Math.floor(diff / 1000));
}

function liveIntervalSeconds(start) {
  return elapsedFromStart(start);
}

function liveTimerSeconds(e) {
  let totalSec = 0;

  for (const iv of e.intervals || []) {
    if (!iv?.start) continue;

    if (iv.end) {
      totalSec += diffSec(iv.start, iv.end, e.date);
    } else if (!e.onLunch) {
      totalSec += liveIntervalSeconds(iv.start);
    }
  }

  /*
   * Обед здесь НЕ вычитаем.
   *
   * После начала обеда текущий рабочий интервал закрывается,
   * а после продолжения создаётся новый интервал.
   * Поэтому обед уже физически отсутствует из суммы рабочих
   * интервалов.
   */
  return Math.max(0, totalSec);
}

function lunchTotalSeconds(e) {
  let sec = (Math.max(0, Number(e.lunch) || 0)) * 60;

  if (e.onLunch && e.lunchStart) {
    sec += diffSec(e.lunchStart, stamp(), e.date);
  }

  return sec;
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

function normalize(e) {
  const intervals =
    Array.isArray(e.intervals) && e.intervals.length
      ? e.intervals
      : [{ start: e.start, end: e.end }];

  const gross = intervals.reduce((sum, i) => {
    if (!i?.start || !i?.end) {
      return sum;
    }

    return sum + minBetween(i.start, i.end);
  }, 0);

  const lunch = Math.max(0, Number(e.lunch) || 0);

  /*
   * Для обычного дня с несколькими интервалами обед уже
   * исключён из gross.
   *
   * Для старого формата с одним интервалом lunch необходимо
   * вычесть отдельно.
   */
  const net =
    intervals.length <= 1
      ? Math.max(0, gross - lunch)
      : gross;

  return {
    ...e,
    intervals,
    gross,
    lunch,
    net,
    balance: net - settings.norm,
    start: displayTime(intervals[0]?.start),
    end: displayTime(intervals.at(-1)?.end)
  };
}

function active() {
  /*
   * Активная запись может быть либо в рабочем интервале,
   * либо на обеде. Во время обеда текущий рабочий интервал
   * уже закрыт, поэтому наличие открытого interval не является
   * обязательным условием активной сессии.
   */
  return data.find(
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

function doneToday() {
  return data.find(
    x => x.date === today() && !x.active
  );
}

function todayEntry() {
  return active() || doneToday();
}

function fixStaleActive() {
  const todayStr = today();
  let changed = false;

  for (const e of data) {
    if (!e.active || e.date === todayStr) continue;

    const current = e.intervals?.find(
      i => i.start && !i.end
    );

    if (current) {
      current.end = e.date + "T23:59:59";
    }

    e.end = e.intervals?.at(-1)?.end || e.start;
    e.active = false;
    e.onLunch = false;
    e.lunchStart = null;
    changed = true;
  }

  if (changed) save();
}

function periodBounds(type) {
  const t = new Date(today() + "T12:00:00");

  if (type === "day") {
    return [new Date(t), new Date(t)];
  }

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

function inBounds(date, a, b) {
  const d = new Date(date + "T12:00:00");
  return d >= a && d <= b;
}

function requiredMinutes(a, b) {
  let total = 0;
  const d = new Date(a);

  while (d <= b) {
    if (settings.workDays.includes(d.getDay())) {
      total += settings.norm;
    }

    d.setDate(d.getDate() + 1);
  }

  return total;
}

function renderToday() {
  const e = todayEntry();
  const a = active();

  $("todayText").textContent =
    new Date().toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });

  $("startView").textContent =
    e ? normalize(e).start : "—";

  $("normView").textContent =
    fmt(settings.norm);

  if (a) {
    const n = liveNormalized(a);

    $("statusBadge").textContent =
      a.onLunch ? "На обеде" : "Работаю";

    $("timerCaption").textContent =
      a.onLunch
        ? "Обед идёт"
        : "Рабочий день идёт";

    $("startBtn").disabled = true;
    $("startBtn").textContent = "▶ Начать работу";
    $("lunchBtn").disabled = false;
    $("finishBtn").disabled = false;

    $("lunchBtn").textContent =
      a.onLunch
        ? "▶ Продолжить работу"
        : "☕ Начать обед";

    $("timer").textContent =
      fmtTimer(liveTimerSeconds(a));

    $("grossView").textContent =
      fmt(n.gross);

    $("netView").textContent =
      fmt(n.net);

    updateLunchView(a);

    $("balanceView").textContent =
      signed(n.net - settings.norm);

  } else if (e) {
    const n = normalize(e);

    $("statusBadge").textContent =
      "День завершён";

    $("timerCaption").textContent =
      "Рабочий день завершён";

    $("startBtn").disabled = false;
    $("startBtn").textContent = "▶ Продолжить работу";
    $("lunchBtn").disabled = true;
    $("finishBtn").disabled = true;

    $("timer").textContent =
      fmtTimer(liveTimerSeconds(e));

    $("grossView").textContent =
      fmt(n.gross);

    $("netView").textContent =
      fmt(n.net);

    updateLunchView(e);

    $("balanceView").textContent =
      signed(n.balance);

  } else {
    $("statusBadge").textContent =
      "Не работаю";

    $("timerCaption").textContent =
      "Сегодня ещё не начинал работу";

    $("startBtn").disabled = false;
    $("startBtn").textContent = "▶ Начать работу";
    $("lunchBtn").disabled = true;
    $("finishBtn").disabled = true;

    $("timer").textContent = "00:00:00";

    $("grossView").textContent =
      "0ч 00м";

    $("netView").textContent =
      "0ч 00м";

    updateLunchView(null);

    $("balanceView").textContent =
      signed(-settings.norm);
  }

  renderIntervals();
}

function liveNormalized(e) {
  const ints = [...(e.intervals || [])];

  let gross = 0;

  for (const i of ints) {
    if (!i?.start) continue;

    if (i.end) {
      gross += diffSec(i.start, i.end, e.date) / 60;
    } else {
      gross += e.onLunch
        ? 0
        : liveIntervalSeconds(i.start) / 60;
    }
  }

  let lunch =
    Math.max(0, Number(e.lunch) || 0);

  if (e.onLunch && e.lunchStart) {
    lunch += minBetween(
      e.lunchStart,
      stamp()
    );
  }

  const net =
    ints.length <= 1
      ? Math.max(0, gross - lunch)
      : gross;

  return {
    gross,
    lunch,
    net
  };
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
        const lunchDur = fmt(minBetween(gapStart, gapEnd, e.date));

        items.push(
          `<div class="interval-item">
            <div>
              <b>Обед</b>
              <small>${displayTime(gapStart)} — ${displayTime(gapEnd)}</small>
            </div>
            <b>${lunchDur}</b>
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

function tick() {
  const a = active();
  const e = todayEntry();

  if (a) {
    const n = liveNormalized(a);

    $("timer").textContent =
      fmtTimer(liveTimerSeconds(a));

    $("grossView").textContent =
      fmt(n.gross);

    $("netView").textContent =
      fmt(n.net);

    updateLunchView(a);
    updateLunchTime(a);

    $("balanceView").textContent =
      signed(n.net - settings.norm);

    return;
  }

  if (e) {
    $("timer").textContent =
      fmtTimer(liveTimerSeconds(e));
    updateLunchTime(e);
    return;
  }

  $("timer").textContent = "00:00:00";
}

function renderStats() {
  const [a, b] =
    periodBounds($("period").value);

  const list = data
    .filter(
      e =>
        !e.active &&
        inBounds(e.date, a, b)
    )
    .map(normalize);

  const net =
    list.reduce(
      (s, e) => s + e.net,
      0
    );

  const req =
    requiredMinutes(a, b);

  $("sDays").textContent =
    list.length;

  $("sNet").textContent =
    fmt(net);

  $("sAvg").textContent =
    fmt(
      list.length
        ? net / list.length
        : 0
    );

  $("sBalance").textContent =
    signed(net - req);

  $("requiredNorm").textContent =
    fmt(req);

  $("requiredNormHint").textContent =
    `Календарная норма: ${settings.workDays.length} рабочих дней в неделю`;

  drawChart(list);
}

function drawChart(list) {
  const c = $("chart");
  const ctx = c.getContext("2d");

  const w = c.clientWidth;
  const h = c.clientHeight;
  const dpr = devicePixelRatio || 1;

  c.width =
    Math.max(1, Math.round(w * dpr));

  c.height =
    Math.max(1, Math.round(h * dpr));

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  ctx.clearRect(0, 0, w, h);

  if (!list.length) {
    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "center";
    ctx.font = "14px sans-serif";

    ctx.fillText(
      "Нет данных для графика",
      w / 2,
      h / 2
    );

    return;
  }

  const max =
    Math.max(
      settings.norm,
      ...list.map(e => e.net),
      60
    );

  const px = 30;
  const py = 20;
  const base = h - 35;
  const uw = w - px * 2;
  const step = uw / list.length;

  list.forEach((e, i) => {
    const bh =
      e.net / max *
      (h - py - 55);

    const x =
      px +
      i * step +
      step * 0.2;

    const bw =
      Math.max(8, step * 0.6);

    ctx.fillStyle = "#111827";

    ctx.fillRect(
      x,
      base - bh,
      bw,
      bh
    );

    ctx.fillStyle = "#6b7280";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";

    ctx.fillText(
      e.date.slice(8),
      x + bw / 2,
      base + 17
    );
  });

  const ny =
    base -
    settings.norm / max *
    (h - py - 55);

  ctx.strokeStyle = "#9ca3af";
  ctx.setLineDash([5, 5]);

  ctx.beginPath();
  ctx.moveTo(px, ny);
  ctx.lineTo(w - px, ny);
  ctx.stroke();

  ctx.setLineDash([]);
}

function renderTable() {
  const list = data
    .filter(
      e =>
        e.date?.startsWith(month) &&
        !e.active
    )
    .map(normalize)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date)
    );

  $("empty").style.display =
    list.length
      ? "none"
      : "block";

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

  document
    .querySelectorAll(".edit")
    .forEach(btn => {
      btn.onclick = () =>
        openEdit(btn.dataset.id);
    });

  document
    .querySelectorAll(".del")
    .forEach(btn => {
      btn.onclick = () => {
        if (
          !confirm(
            "Удалить эту запись?"
          )
        ) {
          return;
        }

        data = data.filter(
          x =>
            String(x.id) !==
            String(btn.dataset.id)
        );

        save();
        renderAll();
      };
    });
}

function openEdit(id) {
  const e = data.find(
    x =>
      String(x.id) ===
      String(id)
  );

  if (!e) return;

  $("editId").value = e.id;
  $("editDate").value = e.date;
  $("editLunch").value =
    Number(e.lunch) || 0;

  const ints =
    Array.isArray(e.intervals) &&
    e.intervals.length
      ? e.intervals
      : [{ start: e.start, end: e.end }];

  renderEditIntervals(ints);

  $("editModal")
    .classList
    .remove("hidden");
}

function renderEditIntervals(ints) {
  $("editIntervals").innerHTML =
    ints.map((i, n) =>
      `<div class="edit-row">
        <label>
          Начало
          <input
            type="time"
            class="edit-start"
            value="${timeInputValue(i.start)}"
            required
          >
        </label>

        <label>
          Конец
          <input
            type="time"
            class="edit-end"
            value="${timeInputValue(i.end)}"
            required
          >
        </label>

        <button
          type="button"
          class="ghost remove-interval"
        >
          ✕
        </button>
      </div>`
    ).join("");

  document
    .querySelectorAll(".remove-interval")
    .forEach(btn => {
      btn.onclick = () => {
        const rows =
          [...document.querySelectorAll(".edit-row")];

        if (rows.length <= 1) {
          alert(
            "Должен остаться хотя бы один интервал."
          );
          return;
        }

        btn.closest(".edit-row")?.remove();
      };
    });
}

function closeEdit() {
  $("editModal")
    .classList
    .add("hidden");
}

document
  .querySelectorAll(".closeEdit")
  .forEach(btn => {
    btn.onclick = closeEdit;
  });

$("addIntervalBtn").onclick = () => {
  const rows =
    [...document.querySelectorAll(".edit-row")];

  const ints = rows.map(row => ({
    start:
      row.querySelector(".edit-start").value,
    end:
      row.querySelector(".edit-end").value
  }));

  ints.push({
    start: "",
    end: ""
  });

  renderEditIntervals(ints);
};

$("editForm").onsubmit = ev => {
  ev.preventDefault();

  const id = $("editId").value;
  const obj = data.find(
    x =>
      String(x.id) ===
      String(id)
  );

  if (!obj) return;

  const date =
    $("editDate").value;

  if (!date) {
    alert("Укажите дату.");
    return;
  }

  const rows =
    [...document.querySelectorAll(".edit-row")];

  const ints = [];

  for (const row of rows) {
    const startRaw =
      row.querySelector(".edit-start").value;

    const endRaw =
      row.querySelector(".edit-end").value;

    /*
     * Проверяем значения ДО добавления :00.
     * Иначе пустое поле превращается в ":00".
     */
    if (!startRaw || !endRaw) {
      alert(
        "Укажите начало и конец каждого интервала."
      );
      return;
    }

    const start =
      combineStamp(date, startRaw);

    const end =
      combineStamp(date, endRaw);

    if (
      !Number.isFinite(
        parseTimeToSec(start)
      ) ||
      !Number.isFinite(
        parseTimeToSec(end)
      )
    ) {
      alert(
        "Некорректное время."
      );
      return;
    }

    ints.push({
      start,
      end
    });
  }

  if (!ints.length) {
    alert(
      "Добавьте хотя бы один интервал."
    );
    return;
  }

  const lunch =
    Math.max(
      0,
      Number($("editLunch").value) || 0
    );

  const gross =
    ints.reduce(
      (sum, i) =>
        sum +
        minBetween(
          i.start,
          i.end
        ),
      0
    );

  /*
   * Если интервалов несколько, lunch уже находится
   * между ними и повторно не вычитается.
   *
   * Если интервал один — это старый/ручной формат,
   * поэтому lunch вычитается.
   */
  if (
    ints.length <= 1 &&
    lunch > gross
  ) {
    alert(
      "Обед не может быть больше рабочего времени."
    );
    return;
  }

  /*
   * Не допускаем две завершённые записи на одну дату.
   */
  const duplicate =
    data.find(
      x =>
        x.date === date &&
        String(x.id) !== String(id)
    );

  if (duplicate) {
    const replace =
      confirm(
        "За эту дату уже есть запись. Заменить её?"
      );

    if (!replace) return;

    data = data.filter(
      x =>
        String(x.id) !==
          String(duplicate.id)
    );
  }

  obj.date = date;
  obj.intervals = ints;
  obj.lunch = lunch;
  obj.start = ints[0].start;
  obj.end =
    ints.at(-1).end;
  obj.active = false;
  delete obj.onLunch;
  delete obj.lunchStart;

  save();

  closeEdit();
  renderAll();
};

$("manualForm").onsubmit = ev => {
  ev.preventDefault();

  const date =
    $("mDate").value;

  const startRaw =
    $("mStart").value;

  const endRaw =
    $("mEnd").value;

  const lunch =
    Math.max(
      0,
      Number($("mLunch").value) || 0
    );

  if (
    !date ||
    !startRaw ||
    !endRaw
  ) {
    alert(
      "Заполните дату, начало и конец."
    );
    return;
  }

  const start =
    combineStamp(date, startRaw);

  const end =
    combineStamp(date, endRaw);

  const gross =
    minBetween(start, end);

  if (lunch > gross) {
    alert(
      "Обед не может быть больше рабочего времени."
    );
    return;
  }

  const existing =
    data.find(
      x =>
        x.date === date &&
        !x.active
    );

  if (existing) {
    const replace =
      confirm(
        "За эту дату уже есть запись. Заменить её?"
      );

    if (!replace) return;

    data = data.filter(
      x =>
        x !== existing
    );
  }

  data.push({
    id:
      Date.now() +
      Math.random(),
    date,
    start,
    end,
    lunch,
    intervals: [
      {
        start,
        end
      }
    ],
    active: false
  });

  save();

  $("manualForm").reset();

  $("mLunch").value = 60;

  renderAll();
};

$("startBtn").onclick = () => {
  if (active()) {
    alert(
      "Рабочий день уже идёт."
    );
    return;
  }

  const start = stamp();
  const finished = doneToday();

  if (finished) {
    const ints =
      Array.isArray(finished.intervals) &&
      finished.intervals.length
        ? finished.intervals
        : [{ start: finished.start, end: finished.end }];

    ints.push({
      start,
      end: null
    });

    finished.intervals = ints;
    finished.start = ints[0].start;
    finished.end = null;
    finished.active = true;
    finished.onLunch = false;
    finished.lunchStart = null;

    save();
    renderAll();
    return;
  }

  data.push({
    id:
      Date.now() +
      Math.random(),
    date: today(),
    start,
    end: null,
    lunch: 0,
    intervals: [
      {
        start,
        end: null
      }
    ],
    active: true,
    onLunch: false,
    lunchStart: null
  });

  save();
  renderAll();
};

$("lunchBtn").onclick = () => {
  const e = active();

  if (!e) return;

  const now = stamp();

  if (!e.onLunch) {
    const current =
      e.intervals?.find(
        i => i.start && !i.end
      );

    if (current) {
      current.end = now;
    }

    e.onLunch = true;
    e.lunchStart = now;

  } else {
    const lunchMinutes =
      minBetween(
        e.lunchStart,
        now
      );

    e.lunch =
      Math.max(
        0,
        Number(e.lunch) || 0
      ) + lunchMinutes;

    const start = now;

    e.intervals.push({
      start,
      end: null
    });

    e.onLunch = false;
    e.lunchStart = null;
  }

  save();
  renderAll();
};

$("finishBtn").onclick = () => {
  const e = active();

  if (!e) return;

  if (
    !confirm(
      "Завершить рабочий день?"
    )
  ) {
    return;
  }

  const now = stamp();

  if (e.onLunch) {
    const lunchMinutes =
      minBetween(
        e.lunchStart,
        now
      );

    e.lunch =
      Math.max(
        0,
        Number(e.lunch) || 0
      ) + lunchMinutes;

    e.onLunch = false;
    e.lunchStart = null;
  }

  const current =
    e.intervals?.find(
      i => i.start && !i.end
    );

  if (current) {
    current.end = now;
  }

  e.active = false;
  e.start = e.intervals?.[0]?.start || e.start;
  e.end = e.intervals?.at(-1)?.end || now;

  save();
  renderAll();
};

$("settingsBtn").onclick = () => {
  $("normInput").value =
    settings.norm / 60;

  [...$("workDays").options]
    .forEach(o => {
      o.selected =
        settings.workDays.includes(
          Number(o.value)
        );
    });

  $("settingsModal")
    .classList
    .remove("hidden");
};

$("closeSettings").onclick = () => {
  $("settingsModal")
    .classList
    .add("hidden");
};

$("period").onchange =
  renderStats;

$("prevMonth").onclick = () => {
  const d =
    new Date(
      `${month}-01T12:00:00`
    );

  d.setMonth(
    d.getMonth() - 1
  );

  month =
    `${d.getFullYear()}-${pad(
      d.getMonth() + 1
    )}`;

  $("monthPicker").value =
    month;

  renderTable();
};

$("nextMonth").onclick = () => {
  const d =
    new Date(
      `${month}-01T12:00:00`
    );

  d.setMonth(
    d.getMonth() + 1
  );

  month =
    `${d.getFullYear()}-${pad(
      d.getMonth() + 1
    )}`;

  $("monthPicker").value =
    month;

  renderTable();
};

$("monthPicker").onchange = () => {
  if ($("monthPicker").value) {
    month =
      $("monthPicker").value;
    renderTable();
  }
};

function renderAll() {
  $("monthPicker").value =
    month;

  renderToday();
  renderTable();

  if (
    $("statsScreen").classList.contains(
      "active"
    )
  ) {
    renderStats();
  }
}

$("saveSettings").onclick = () => {
  const h =
    Number($("normInput").value);

  const days =
    [...$("workDays").selectedOptions]
      .map(o => Number(o.value));

  if (
    !Number.isFinite(h) ||
    h < 0 ||
    h > 24 ||
    !days.length
  ) {
    alert(
      "Укажите норму и хотя бы один рабочий день."
    );
    return;
  }

  settings = {
    norm: Math.round(h * 60),
    workDays: days
  };

  localStorage.setItem(
    SETTINGS,
    JSON.stringify(settings)
  );

  $("settingsModal")
    .classList
    .add("hidden");

  renderAll();
};

$("clearBtn").onclick = () => {
  if (
    confirm(
      "Удалить все рабочие дни?"
    )
  ) {
    data = [];

    save();

    $("settingsModal")
      .classList
      .add("hidden");

    renderAll();
  }
};

$("exportBtn").onclick = () => {
  const list = data
    .filter(
      e =>
        e.date?.startsWith(month) &&
        !e.active
    )
    .map(normalize);

  const rows = [
    [
      "Дата",
      "Интервалы",
      "Обед, мин",
      "На работе, мин",
      "Отработано, мин",
      "Баланс, мин"
    ],
    ...list.map(e => [
      e.date,
      e.intervals
        .map(
          i =>
            `${i.start}-${i.end}`
        )
        .join(", "),
      e.lunch,
      e.gross,
      e.net,
      e.balance
    ])
  ];

  const csv =
    "\uFEFF" +
    rows
      .map(row =>
        row
          .map(value =>
            `"${String(value)
              .replaceAll('"', '""')}"`
          )
          .join(";")
      )
      .join("\n");

  const url =
    URL.createObjectURL(
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8"
        }
      )
    );

  const a =
    document.createElement("a");

  a.href = url;
  a.download =
    `work-time-${month}.csv`;

  a.click();

  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    1000
  );
};

document
  .querySelectorAll(".tab")
  .forEach(b => {
    b.onclick = () => {
      document
        .querySelectorAll(".tab")
        .forEach(x =>
          x.classList.remove(
            "active"
          )
        );

      document
        .querySelectorAll(".screen")
        .forEach(x =>
          x.classList.remove(
            "active"
          )
        );

      b.classList.add("active");

      $(
        `${b.dataset.screen}Screen`
      ).classList.add("active");

      if (
        b.dataset.screen ===
        "stats"
      ) {
        renderStats();
      }

      if (
        b.dataset.screen ===
        "history"
      ) {
        renderTable();
      }
    };
  });

window.addEventListener(
  "resize",
  () => {
    if (
      $("statsScreen").classList.contains(
        "active"
      )
    ) {
      renderStats();
    }
  }
);

setInterval(
  tick,
  1000
);

fixStaleActive();
renderAll();
tick();

const THEME_KEY = "workTimeTheme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = $("themeToggle");
  if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem(THEME_KEY, theme);
}

(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
})();

$("themeToggle").onclick = () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
};

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .catch(() => {});
}
