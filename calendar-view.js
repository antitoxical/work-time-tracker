import { $, pad, fmt, signed } from "./utils.js";
import { getData, setData, getSettings, save } from "./storage.js";
import { today } from "./time.js";
import { normalize } from "./normalize.js";

let calendar = null;
let selectedDate = null;

export function initCalendarView() {
  try {
    const calEl = document.getElementById("fullCalendar");
    if (!calEl || typeof FullCalendar === "undefined") {
      console.warn("FullCalendar not loaded");
      return;
    }

    calendar = new FullCalendar.Calendar(calEl, {
      initialView: "dayGridMonth",
      locale: "ru",
      firstDay: 1,
      height: "auto",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth"
      },
      buttonText: {
        today: "Сегодня",
        month: "Месяц"
      },
      dateClick: function (info) {
        selectedDate = info.dateStr;
        const data = getData();
        const hasEntry = data.some(e => e.date === info.dateStr);

        document.querySelectorAll(".fc-day-selected").forEach(el => el.classList.remove("fc-day-selected"));
        info.dayEl.classList.add("fc-day-selected");

        if (hasEntry) {
          showDayDetail(info.dateStr);
        } else {
          openQuickAdd(info.dateStr);
        }
      },
      eventClick: function (info) {
        selectedDate = info.event.startStr;

        document.querySelectorAll(".fc-day-selected").forEach(el => el.classList.remove("fc-day-selected"));
        const cell = document.querySelector(`[data-date="${info.event.startStr}"]`);
        if (cell) cell.classList.add("fc-day-selected");

        showDayDetail(info.event.startStr);
      },
      events: getCalendarEvents(),
      eventDisplay: "block",
      dayMaxEvents: 2,
    });

    calendar.render();

    const closeBtn = $("calDetailClose");
    if (closeBtn) closeBtn.onclick = () => {
      selectedDate = null;
      $("calDayDetail").classList.add("hidden");
      document.querySelectorAll(".fc-day-selected").forEach(el => el.classList.remove("fc-day-selected"));
    };

    const addBtn = $("calAddEntry");
    if (addBtn) addBtn.onclick = () => {
      if (!selectedDate) return;
      openAddForDate(selectedDate);
    };

  } catch (e) {
    console.warn("FullCalendar init error:", e);
  }
}

function getCalendarEvents() {
  const data = getData();
  const settings = getSettings();
  const events = [];

  for (const entry of data) {
    if (entry.active) {
      events.push({
        title: "Идёт…",
        start: entry.date,
        color: "#007aff",
        textColor: "#fff",
        classNames: ["fc-event-active"],
      });
    } else {
      const n = normalize(entry);
      const mins = n.net;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const isOk = mins >= settings.norm;

      events.push({
        title: `${h}:${pad(m)}`,
        start: entry.date,
        color: isOk ? "rgba(52, 199, 89, 0.15)" : "rgba(255, 149, 0, 0.15)",
        textColor: isOk ? "#1a7d37" : "#c77c00",
        borderColor: isOk ? "rgba(52, 199, 89, 0.3)" : "rgba(255, 149, 0, 0.3)",
        classNames: [isOk ? "fc-event-ok" : "fc-event-warn"],
        extendedProps: {
          entryId: entry.id,
          net: mins,
          start: n.start,
          end: n.end,
          lunch: n.lunch,
          balance: n.balance,
        }
      });
    }
  }

  return events;
}

export function renderCalendarGrid() {
  if (calendar) {
    calendar.removeAllEvents();
    calendar.addEventSource(getCalendarEvents());
  }
}

function showDayDetail(dateStr) {
  try {
    const data = getData();
    const settings = getSettings();
    const entries = data.filter(e => e.date === dateStr);
    const panel = $("calDayDetail");
    const content = $("calDetailContent");

    if (!panel || !content) return;

    const d = new Date(dateStr + "T12:00:00");
    const dow = d.getDay();
    const DAYS_FULL = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
    const MONTHS_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
    const dateEl = $("calDetailDate");
    if (dateEl) dateEl.textContent = `${DAYS_FULL[dow]}, ${d.getDate()} ${MONTHS_RU[d.getMonth()]}`;

    panel.classList.remove("hidden");

    if (!entries.length) {
      content.innerHTML = `
        <div class="cal-detail-empty">
          <div class="cal-detail-empty-icon">📋</div>
          <div>Нет записей</div>
          <div class="cal-detail-empty-hint">Нажмите «+» чтобы добавить</div>
        </div>`;
      return;
    }

    const parts = [];
    for (const entry of entries) {
      const n = normalize(entry);
      const statusClass = entry.active ? "active" : (n.net >= settings.norm ? "ok" : "partial");
      const statusText = entry.active ? "В процессе" : (n.net >= settings.norm ? "Норма выполнена" : "Неполный день");

      parts.push(`
        <div class="cal-detail-entry">
          <div class="cal-detail-status ${statusClass}">${statusText}</div>
          <div class="cal-detail-grid">
            <div class="cal-detail-cell">
              <span class="cal-detail-label">Начало</span>
              <span class="cal-detail-value">${n.start}</span>
            </div>
            <div class="cal-detail-cell">
              <span class="cal-detail-label">Конец</span>
              <span class="cal-detail-value">${entry.active ? "…" : n.end}</span>
            </div>
            <div class="cal-detail-cell">
              <span class="cal-detail-label">Обед</span>
              <span class="cal-detail-value">${fmt(n.lunch)}</span>
            </div>
            <div class="cal-detail-cell">
              <span class="cal-detail-label">Отработано</span>
              <span class="cal-detail-value ${statusClass}">${fmt(n.net)}</span>
            </div>
          </div>
          <div class="cal-detail-row">
            <span class="cal-detail-label">Баланс за день</span>
            <span class="cal-detail-value">${signed(n.balance)}</span>
          </div>
          <div class="cal-detail-actions">
            <button class="ghost cal-edit-btn" data-id="${entry.id}">✎ Изменить</button>
            <button class="ghost cal-del-btn" data-id="${entry.id}">✕ Удалить</button>
          </div>
        </div>
      `);
    }

    content.innerHTML = parts.join("");

    content.querySelectorAll(".cal-edit-btn").forEach(btn => {
      btn.onclick = () => {
        const e = getData().find(x => String(x.id) === String(btn.dataset.id));
        if (!e) return;
        $("editId").value = e.id;
        $("editDate").value = e.date;
        $("editLunch").value = Number(e.lunch) || 0;
        const ints = Array.isArray(e.intervals) && e.intervals.length
          ? e.intervals
          : [{ start: e.start, end: e.end }];
        renderEditIntervals(ints);
        $("editModal").classList.remove("hidden");
      };
    });

    content.querySelectorAll(".cal-del-btn").forEach(btn => {
      btn.onclick = () => {
        if (!confirm("Удалить эту запись?")) return;
        setData(getData().filter(x => String(x.id) !== String(btn.dataset.id)));
        save();
        showDayDetail(dateStr);
        renderCalendarGrid();
      };
    });
  } catch (e) {
    console.warn("Day detail error:", e);
  }
}

function renderEditIntervals(ints) {
  $("editIntervals").innerHTML =
    ints.map((i) =>
      `<div class="edit-row">
        <label>Начало<input type="time" class="edit-start" value="${timeInputValue(i.start)}"></label>
        <label>Конец<input type="time" class="edit-end" value="${timeInputValue(i.end)}"></label>
        <button type="button" class="ghost remove-interval">✕</button>
      </div>`
    ).join("");

  document.querySelectorAll(".remove-interval").forEach(btn => {
    btn.onclick = () => {
      const rows = [...document.querySelectorAll(".edit-row")];
      if (rows.length <= 1) { alert("Должен остаться хотя бы один интервал."); return; }
      btn.closest(".edit-row")?.remove();
    };
  });
}

function timeInputValue(t) {
  if (!t) return "";
  const s = String(t);
  return s.includes("T") ? s.split("T")[1].slice(0, 5) : s.slice(0, 5);
}

function openAddForDate(dateStr) {
  $("mDate").value = dateStr;
  $("mStart").value = "";
  $("mEnd").value = "";
  $("mLunch").value = "60";

  document.querySelector('[data-screen="history"]').click();
  setTimeout(() => $("mStart").focus(), 100);
}

function openQuickAdd(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const DAYS = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

  $("editId").value = "";
  $("editDate").value = dateStr;
  $("editLunch").value = "60";

  renderEditIntervals([{ start: "", end: "" }]);

  const modal = $("editModal");
  modal.classList.remove("hidden");

  const titleEl = modal.querySelector("h2");
  if (titleEl) titleEl.textContent = `${DAYS[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;

  const startInput = modal.querySelector(".edit-start");
  if (startInput) setTimeout(() => startInput.focus(), 100);
}
