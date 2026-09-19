import { $, pad, fmt, signed, timeInputValue, combineStamp, displayTime } from "./utils.js";
import { getData, setData, getSettings, setSettings, save } from "./storage.js";
import { today, stamp, minBetween, parseTimeToSec, parseStamp } from "./time.js";
import { normalize } from "./normalize.js";
import {
  active,
  doneToday,
  getMonth,
  setMonth,
  renderAll,
  renderTable,
  renderStats,
  renderToday
} from "./render.js";

function renderCalendarGrid() {
  if (window._renderCalendarGrid) window._renderCalendarGrid();
}

export function fixStaleActive() {
  const todayStr = today();
  let changed = false;

  for (const e of getData()) {
    if (!e.active || e.date === todayStr) continue;

    const current = e.intervals?.find(i => i.start && !i.end);
    if (current) current.end = e.date + "T23:59:59";

    e.end = e.intervals?.at(-1)?.end || e.start;
    e.active = false;
    e.onLunch = false;
    e.lunchStart = null;
    changed = true;
  }

  if (changed) save();
}

export function setupHandlers() {
  const data = getData;

  // Delete + Edit from table
  document.addEventListener("click", ev => {
    const btn = ev.target.closest(".del");
    if (btn) {
      if (!confirm("Удалить эту запись?")) return;
      setData(getData().filter(x => String(x.id) !== String(btn.dataset.id)));
      save();
      renderAll();
      return;
    }

    const editBtn = ev.target.closest(".edit");
    if (editBtn) {
      openEdit(editBtn.dataset.id);
    }
  });

  // Edit modal
  document.querySelectorAll(".closeEdit").forEach(btn => {
    btn.onclick = closeEdit;
  });

  $("addIntervalBtn").onclick = () => {
    const rows = [...document.querySelectorAll(".edit-row")];
    const ints = rows.map(row => ({
      start: row.querySelector(".edit-start").value,
      end: row.querySelector(".edit-end").value
    }));
    ints.push({ start: "", end: "" });
    renderEditIntervals(ints);
  };

  $("editForm").onsubmit = handleEditSubmit;

  // Manual form
  $("manualForm").onsubmit = handleManualSubmit;

  // Main actions
  $("startBtn").onclick = handleStart;
  $("lunchBtn").onclick = handleLunch;
  $("finishBtn").onclick = handleFinish;

  // Settings
  $("settingsBtn").onclick = openSettings;
  $("closeSettings").onclick = () => $("settingsModal").classList.add("hidden");
  $("saveSettings").onclick = handleSaveSettings;
  $("clearBtn").onclick = handleClear;
  $("exportBtn").onclick = handleExport;

  // Period / Month
  $("period").onchange = renderStats;

  const MONTHS_RU = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

  function updateMonthLabel() {
    const m = getMonth();
    const [y, mo] = m.split("-");
    $("monthLabel").textContent = `${MONTHS_RU[Number(mo) - 1]} ${y}`;
  }

  $("prevMonth").onclick = () => {
    const d = new Date(`${getMonth()}-01T12:00:00`);
    d.setMonth(d.getMonth() - 1);
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    updateMonthLabel();
    renderTable();
  };

  $("nextMonth").onclick = () => {
    const d = new Date(`${getMonth()}-01T12:00:00`);
    d.setMonth(d.getMonth() + 1);
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    updateMonthLabel();
    renderTable();
  };

  updateMonthLabel();

  // Tabs
  document.querySelectorAll(".tab").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".screen").forEach(x => x.classList.remove("active"));

      b.classList.add("active");
      $(`${b.dataset.screen}Screen`).classList.add("active");

      if (b.dataset.screen === "calendar") renderCalendarGrid();
      if (b.dataset.screen === "stats") renderStats();
      if (b.dataset.screen === "history") renderTable();
    };
  });

  // Resize
  window.addEventListener("resize", () => {
    if ($("statsScreen").classList.contains("active")) renderStats();
  });
}

function openEdit(id) {
  const e = getData().find(x => String(x.id) === String(id));
  if (!e) return;

  $("editId").value = e.id;
  $("editDate").value = e.date;
  $("editLunch").value = Number(e.lunch) || 0;

  const ints =
    Array.isArray(e.intervals) && e.intervals.length
      ? e.intervals
      : [{ start: e.start, end: e.end }];

  renderEditIntervals(ints);
  $("editModal").classList.remove("hidden");
}

function renderEditIntervals(ints) {
  $("editIntervals").innerHTML =
    ints.map((i, n) =>
      `<div class="edit-row">
        <label>
          Начало
          <input type="time" class="edit-start" value="${timeInputValue(i.start)}">
        </label>
        <label>
          Конец
          <input type="time" class="edit-end" value="${timeInputValue(i.end)}">
        </label>
        <button type="button" class="ghost remove-interval">✕</button>
      </div>`
    ).join("");

  document.querySelectorAll(".remove-interval").forEach(btn => {
    btn.onclick = () => {
      const rows = [...document.querySelectorAll(".edit-row")];
      if (rows.length <= 1) {
        alert("Должен остаться хотя бы один интервал.");
        return;
      }
      btn.closest(".edit-row")?.remove();
    };
  });
}

function closeEdit() {
  $("editModal").classList.add("hidden");
}

function handleEditSubmit(ev) {
  ev.preventDefault();

  const id = $("editId").value;
  const isEdit = !!id;
  const obj = isEdit ? getData().find(x => String(x.id) === String(id)) : null;
  if (isEdit && !obj) return;

  const date = $("editDate").value;
  if (!date) { alert("Укажите дату."); return; }

  const rows = [...document.querySelectorAll(".edit-row")];
  const ints = [];

  for (const row of rows) {
    const startRaw = row.querySelector(".edit-start").value;
    const endRaw = row.querySelector(".edit-end").value;

    if (!startRaw || !endRaw) {
      alert("Укажите начало и конец каждого интервала.");
      return;
    }

    const start = combineStamp(date, startRaw);
    const end = combineStamp(date, endRaw);

    if (!Number.isFinite(parseTimeToSec(start)) || !Number.isFinite(parseTimeToSec(end))) {
      alert("Некорректное время.");
      return;
    }

    const startSec = parseTimeToSec(start);
    const endSec = parseTimeToSec(end);

    if (endSec <= startSec) {
      alert(`Конец должен быть позже начала (${startRaw} → ${endRaw}).`);
      return;
    }

    if (endSec - startSec < 1) {
      alert("Интервал слишком короткий (минимум1 минута).");
      return;
    }

    ints.push({ start, end });
  }

  if (!ints.length) { alert("Добавьте хотя бы один интервал."); return; }

  // Check overlapping intervals
  const sorted = [...ints].sort((a, b) => parseTimeToSec(a.start) - parseTimeToSec(b.start));
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = parseTimeToSec(sorted[i - 1].end);
    const currStart = parseTimeToSec(sorted[i].start);
    if (currStart < prevEnd) {
      const prevIdx = ints.indexOf(sorted[i - 1]) + 1;
      const currIdx = ints.indexOf(sorted[i]) + 1;
      alert(`Интервалы ${prevIdx} и ${currIdx} пересекаются.`);
      return;
    }
  }

  const lunch = Math.max(0, Number($("editLunch").value) || 0);
  const gross = ints.reduce((sum, i) => sum + minBetween(i.start, i.end), 0);

  if (lunch > gross) {
    alert("Обед не может быть больше рабочего времени.");
    return;
  }

  const duplicate = getData().find(
    x => x.date === date && String(x.id) !== String(id)
  );

  if (duplicate) {
    if (!confirm("За эту дату уже есть запись. Заменить её?")) return;
    setData(getData().filter(x => String(x.id) !== String(duplicate.id)));
  }

  if (isEdit && obj) {
    obj.date = date;
    obj.intervals = ints;
    obj.lunch = lunch;
    obj.start = ints[0].start;
    obj.end = ints.at(-1).end;
    obj.active = false;
    delete obj.onLunch;
    delete obj.lunchStart;
  } else {
    getData().push({
      id: Date.now() + Math.random(),
      date, start: ints[0].start, end: ints.at(-1).end, lunch,
      intervals: ints,
      active: false
    });
  }

  save();
  closeEdit();
  renderAll();
  renderCalendarGrid();
}

function handleManualSubmit(ev) {
  ev.preventDefault();

  const date = $("mDate").value;
  const startRaw = $("mStart").value;
  const endRaw = $("mEnd").value;
  const lunch = Math.max(0, Number($("mLunch").value) || 0);

  if (!date || !startRaw || !endRaw) {
    alert("Заполните дату, начало и конец.");
    return;
  }

  const start = combineStamp(date, startRaw);
  const end = combineStamp(date, endRaw);

  const startSec = parseTimeToSec(start);
  const endSec = parseTimeToSec(end);

  if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) {
    alert("Некорректное время.");
    return;
  }

  if (endSec <= startSec) {
    alert("Конец должен быть позже начала.");
    return;
  }

  if (endSec - startSec < 1) {
    alert("Интервал слишком короткий (минимум1 минута).");
    return;
  }

  const gross = minBetween(start, end);

  if (lunch > gross) {
    alert("Обед не может быть больше рабочего времени.");
    return;
  }

  const existing = getData().find(x => x.date === date && !x.active);

  if (existing) {
    if (!confirm("За эту дату уже есть запись. Заменить её?")) return;
    setData(getData().filter(x => x !== existing));
  }

  getData().push({
    id: Date.now() + Math.random(),
    date, start, end, lunch,
    intervals: [{ start, end }],
    active: false
  });

  save();
  $("manualForm").reset();
  $("mLunch").value = 60;
  renderAll();
  renderCalendarGrid();
}

function handleStart() {
  if (active()) { alert("Рабочий день уже идёт."); return; }

  const start = stamp();
  const finished = doneToday();

  if (finished) {
    const ints =
      Array.isArray(finished.intervals) && finished.intervals.length
        ? finished.intervals
        : [{ start: finished.start, end: finished.end }];

    ints.push({ start, end: null });
    finished.intervals = ints;
    finished.start = ints[0].start;
    finished.end = null;
    finished.active = true;
    finished.onLunch = false;
    finished.lunchStart = null;
    save();
    renderAll();
    renderCalendarGrid();
    return;
  }

  getData().push({
    id: Date.now() + Math.random(),
    date: today(),
    start, end: null, lunch: 0,
    intervals: [{ start, end: null }],
    active: true,
    onLunch: false,
    lunchStart: null
  });

  save();
  renderAll();
  renderCalendarGrid();
}

function handleLunch() {
  const e = active();
  if (!e) return;

  const now = stamp();

  if (!e.onLunch) {
    const current = e.intervals?.find(i => i.start && !i.end);
    if (current) current.end = now;

    e.onLunch = true;
    e.lunchStart = now;
  } else {
    const lunchMinutes = minBetween(e.lunchStart, now);
    e.lunch = Math.max(0, Number(e.lunch) || 0) + lunchMinutes;

    e.intervals.push({ start: now, end: null });
    e.onLunch = false;
    e.lunchStart = null;
  }

  save();
  renderAll();
  renderCalendarGrid();
}

function handleFinish() {
  const e = active();
  if (!e) return;
  if (!confirm("Завершить рабочий день?")) return;

  const now = stamp();

  if (e.onLunch) {
    const lunchMinutes = minBetween(e.lunchStart, now);
    e.lunch = Math.max(0, Number(e.lunch) || 0) + lunchMinutes;
    e.onLunch = false;
    e.lunchStart = null;
  }

  const current = e.intervals?.find(i => i.start && !i.end);
  if (current) current.end = now;

  e.active = false;
  e.start = e.intervals?.[0]?.start || e.start;
  e.end = e.intervals?.at(-1)?.end || now;

  save();
  renderAll();
  renderCalendarGrid();
}

function openSettings() {
  $("normInput").value = getSettings().norm / 60;

  [...$("workDays").options].forEach(o => {
    o.selected = getSettings().workDays.includes(Number(o.value));
  });

  $("settingsModal").classList.remove("hidden");
}

function handleSaveSettings() {
  const h = Number($("normInput").value);
  const days = [...$("workDays").selectedOptions].map(o => Number(o.value));

  if (!Number.isFinite(h) || h < 0 || h > 24 || !days.length) {
    alert("Укажите норму и хотя бы один рабочий день.");
    return;
  }

  setSettings({ norm: Math.round(h * 60), workDays: days });
  $("settingsModal").classList.add("hidden");
  renderAll();
  renderCalendarGrid();
}

function handleClear() {
  if (confirm("Удалить все рабочие дни?")) {
    setData([]);
    save();
    $("settingsModal").classList.add("hidden");
    renderAll();
    renderCalendarGrid();
  }
}

function handleExport() {
  const list = getData()
    .filter(e => e.date?.startsWith(getMonth()) && !e.active)
    .map(normalize);

  const rows = [
    ["Дата", "Интервалы", "Обед, мин", "На работе, мин", "Отработано, мин", "Баланс, мин"],
    ...list.map(e => [
      e.date,
      e.intervals.map(i => `${i.start}-${i.end}`).join(", "),
      e.lunch, e.gross, e.net, e.balance
    ])
  ];

  const csv =
    "\uFEFF" +
    rows.map(row =>
      row.map(value =>
        `"${String(value).replaceAll('"', '""')}"`
      ).join(";")
    ).join("\n");

  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `work-time-${getMonth()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}