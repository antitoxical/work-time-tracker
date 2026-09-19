const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

const MONTHS_SHORT = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"
];

export function initCalendar(monthPicker, onChange) {
  const container = monthPicker.parentElement;
  monthPicker.style.display = "none";

  const cal = document.createElement("div");
  cal.className = "apple-cal";
  container.appendChild(cal);

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();

  if (monthPicker.value) {
    const parts = monthPicker.value.split("-");
    currentYear = Number(parts[0]);
    currentMonth = Number(parts[1]) - 1;
  }

  function render() {
    cal.innerHTML = `
      <div class="cal-header">
        <button type="button" class="cal-nav cal-prev">‹</button>
        <span class="cal-title">${currentYear}</span>
        <button type="button" class="cal-nav cal-next">›</button>
      </div>
      <div class="cal-grid">
        ${MONTHS_SHORT.map((m, i) => {
          const isActive = i === currentMonth;
          return `<button type="button" class="cal-month${isActive ? " active" : ""}" data-month="${i}">${m}</button>`;
        }).join("")}
      </div>
    `;

    cal.querySelector(".cal-prev").onclick = () => {
      currentYear--;
      render();
    };

    cal.querySelector(".cal-next").onclick = () => {
      currentYear++;
      render();
    };

    cal.querySelectorAll(".cal-month").forEach(btn => {
      btn.onclick = () => {
        currentMonth = Number(btn.dataset.month);
        const val = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
        monthPicker.value = val;
        onChange(val);
        render();
      };
    });
  }

  render();

  return {
    getValue: () => `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`,
    setValue: (v) => {
      const parts = v.split("-");
      currentYear = Number(parts[0]);
      currentMonth = Number(parts[1]) - 1;
      monthPicker.value = v;
      render();
    }
  };
}
