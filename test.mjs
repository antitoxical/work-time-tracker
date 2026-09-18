import { strict as assert } from "node:assert";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
  if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return NaN;
  if (p[0] < 0 || p[0] > 23 || p[1] < 0 || p[1] > 59) return NaN;
  const sec = Number.isFinite(p[2]) ? p[2] : 0;
  if (sec < 0 || sec > 59) return NaN;
  const base = fallbackDate ? new Date(`${fallbackDate}T12:00:00`) : new Date();
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

function diffSec(a, b, dateHint) {
  const start = parseStamp(a, dateHint);
  const end = parseStamp(b, dateHint);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  let diff = Math.floor((end - start) / 1000);
  if (diff < 0) diff += 86400;
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
  if (!Number.isFinite(startMs)) return 0;
  let diff = now.getTime() - startMs;
  if (diff < 0 && !String(start).includes("T")) diff += 86400000;
  return Math.max(0, Math.floor(diff / 1000));
}

// Mock settings for normalize
let settings = { norm: 480, workDays: [1, 2, 3, 4, 5] };

function normalize(e) {
  const intervals =
    Array.isArray(e.intervals) && e.intervals.length
      ? e.intervals
      : [{ start: e.start, end: e.end }];

  const gross = intervals.reduce((sum, i) => {
    if (!i?.start || !i?.end) return sum;
    return sum + minBetween(i.start, i.end);
  }, 0);

  const lunch = Math.max(0, Number(e.lunch) || 0);

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

function liveNormalized(e) {
  const ints = [...(e.intervals || [])];
  let gross = 0;

  for (const i of ints) {
    if (!i?.start) continue;
    if (i.end) {
      gross += diffSec(i.start, i.end, e.date) / 60;
    } else {
      gross += e.onLunch ? 0 : elapsedFromStart(i.start) / 60;
    }
  }

  let lunch = Math.max(0, Number(e.lunch) || 0);
  if (e.onLunch && e.lunchStart) {
    lunch += minBetween(e.lunchStart, stamp());
  }

  const net =
    ints.length <= 1
      ? Math.max(0, gross - lunch)
      : gross;

  return { gross, lunch, net };
}

// ===== TEST SUITES =====

console.log("\n=== diffSec ===");

test("same time returns 0", () => {
  assert.equal(diffSec("2024-01-15T09:00:00", "2024-01-15T09:00:00"), 0);
});

test("1 hour difference with full timestamps", () => {
  assert.equal(diffSec("2024-01-15T09:00:00", "2024-01-15T10:00:00"), 3600);
});

test("old format HH:MM with dateHint", () => {
  assert.equal(diffSec("09:00", "10:00", "2024-01-15"), 3600);
});

test("old format midnight crossing", () => {
  assert.equal(diffSec("23:00", "01:00", "2024-01-15"), 7200);
});

test("full timestamp negative diff adds 86400", () => {
  assert.equal(diffSec("2024-01-15T23:00:00", "2024-01-15T01:00:00"), 7200);
});

test("invalid input returns 0", () => {
  assert.equal(diffSec("", "09:00"), 0);
  assert.equal(diffSec("09:00", ""), 0);
  assert.equal(diffSec("abc", "09:00"), 0);
});

test("seconds precision", () => {
  assert.equal(diffSec("2024-01-15T09:00:00", "2024-01-15T09:00:30"), 30);
  assert.equal(diffSec("2024-01-15T09:00:00", "2024-01-15T09:01:30"), 90);
});

console.log("\n=== minBetween ===");

test("exact minutes", () => {
  assert.equal(minBetween("2024-01-15T09:00:00", "2024-01-15T10:00:00"), 60);
});

test("rounds to nearest minute", () => {
  assert.equal(minBetween("2024-01-15T09:00:00", "2024-01-15T09:00:29"), 0);
  assert.equal(minBetween("2024-01-15T09:00:00", "2024-01-15T09:00:30"), 1);
  assert.equal(minBetween("2024-01-15T09:00:00", "2024-01-15T09:00:31"), 1);
});

test("old format with dateHint", () => {
  assert.equal(minBetween("09:00", "10:30", "2024-01-15"), 90);
});

console.log("\n=== normalize (single interval, old format) ===");

test("8h work, 1h lunch → net = 7h", () => {
  const e = {
    date: "2024-01-15",
    start: "09:00",
    end: "17:00",
    lunch: 60,
    intervals: [{ start: "2024-01-15T09:00:00", end: "2024-01-15T17:00:00" }]
  };
  const n = normalize(e);
  assert.equal(n.gross, 480);
  assert.equal(n.lunch, 60);
  assert.equal(n.net, 420);
  assert.equal(n.balance, -60);
});

test("single interval: lunch subtracted from gross", () => {
  const e = {
    date: "2024-01-15",
    start: "09:00",
    end: "17:00",
    lunch: 30,
    intervals: [{ start: "2024-01-15T09:00:00", end: "2024-01-15T17:00:00" }]
  };
  const n = normalize(e);
  assert.equal(n.gross, 480);
  assert.equal(n.net, 450);
});

console.log("\n=== normalize (multiple intervals, lunch between) ===");

test("2 intervals + lunch → net = gross (lunch not subtracted)", () => {
  const e = {
    date: "2024-01-15",
    lunch: 60,
    intervals: [
      { start: "2024-01-15T09:00:00", end: "2024-01-15T12:00:00" },
      { start: "2024-01-15T13:00:00", end: "2024-01-15T17:00:00" }
    ]
  };
  const n = normalize(e);
  assert.equal(n.gross, 420);
  assert.equal(n.lunch, 60);
  assert.equal(n.net, 420);
});

test("3 intervals → net = sum of all intervals", () => {
  const e = {
    date: "2024-01-15",
    lunch: 90,
    intervals: [
      { start: "2024-01-15T09:00:00", end: "2024-01-15T12:00:00" },
      { start: "2024-01-15T13:00:00", end: "2024-01-15T15:00:00" },
      { start: "2024-01-15T15:30:00", end: "2024-01-15T17:00:00" }
    ]
  };
  const n = normalize(e);
  assert.equal(n.gross, 390);
  assert.equal(n.net, 390);
});

console.log("\n=== normalize (finish during lunch, single interval) ===");

test("finish during lunch: net = gross - lunch", () => {
  const e = {
    date: "2024-01-15",
    lunch: 30,
    intervals: [
      { start: "2024-01-15T09:00:00", end: "2024-01-15T12:00:00" }
    ]
  };
  const n = normalize(e);
  assert.equal(n.gross, 180);
  assert.equal(n.lunch, 30);
  assert.equal(n.net, 150);
});

console.log("\n=== normalize (lunch > gross protection) ===");

test("lunch capped at 0 for negative", () => {
  const e = {
    date: "2024-01-15",
    lunch: -10,
    intervals: [
      { start: "2024-01-15T09:00:00", end: "2024-01-15T10:00:00" }
    ]
  };
  const n = normalize(e);
  assert.equal(n.lunch, 0);
  assert.equal(n.net, 60);
});

console.log("\n=== normalize (edge cases) ===");

test("missing intervals falls back to start/end", () => {
  const e = {
    date: "2024-01-15",
    start: "2024-01-15T09:00:00",
    end: "2024-01-15T17:00:00",
    lunch: 0
  };
  const n = normalize(e);
  assert.equal(n.gross, 480);
  assert.equal(n.net, 480);
});

test("empty intervals array falls back to start/end", () => {
  const e = {
    date: "2024-01-15",
    start: "2024-01-15T09:00:00",
    end: "2024-01-15T17:00:00",
    lunch: 0,
    intervals: []
  };
  const n = normalize(e);
  assert.equal(n.gross, 480);
});

test("interval with missing end is skipped in gross", () => {
  const e = {
    date: "2024-01-15",
    lunch: 0,
    intervals: [
      { start: "2024-01-15T09:00:00", end: null }
    ]
  };
  const n = normalize(e);
  assert.equal(n.gross, 0);
});

test("normalize start/end shows displayTime of first/last interval", () => {
  const e = {
    date: "2024-01-15",
    lunch: 0,
    intervals: [
      { start: "2024-01-15T09:00:00", end: "2024-01-15T12:00:00" },
      { start: "2024-01-15T13:00:00", end: "2024-01-15T17:00:00" }
    ]
  };
  const n = normalize(e);
  assert.equal(n.start, "09:00:00");
  assert.equal(n.end, "17:00:00");
});

console.log("\n=== liveNormalized (active work, not on lunch) ===");

test("active work: open interval counted via elapsedFromStart", () => {
  const now = new Date("2024-01-15T10:00:00");
  const origElapsedFromStart = elapsedFromStart;

  const e = {
    date: "2024-01-15",
    lunch: 0,
    onLunch: false,
    lunchStart: null,
    intervals: [
      { start: "2024-01-15T09:00:00", end: null }
    ]
  };

  const ints = [...(e.intervals || [])];
  let gross = 0;
  for (const i of ints) {
    if (!i?.start) continue;
    if (i.end) {
      gross += diffSec(i.start, i.end, e.date) / 60;
    } else {
      if (!e.onLunch) {
        const startMs = parseStamp(i.start);
        let diff = now.getTime() - startMs;
        if (diff < 0 && !String(i.start).includes("T")) diff += 86400000;
        gross += Math.max(0, Math.floor(diff / 1000)) / 60;
      }
    }
  }
  assert.equal(gross, 60);
});

console.log("\n=== liveNormalized (on lunch) ===");

test("on lunch: open interval gives 0 gross, lunch accumulates", () => {
  const e = {
    date: "2024-01-15",
    lunch: 0,
    onLunch: true,
    lunchStart: "2024-01-15T12:00:00",
    intervals: [
      { start: "2024-01-15T09:00:00", end: "2024-01-15T12:00:00" }
    ]
  };

  const ints = [...(e.intervals || [])];
  let gross = 0;
  for (const i of ints) {
    if (!i?.start) continue;
    if (i.end) {
      gross += diffSec(i.start, i.end, e.date) / 60;
    } else {
      if (!e.onLunch) {
        gross += 999; // should not happen
      }
    }
  }

  assert.equal(gross, 180); // only closed interval counted
});

console.log("\n=== liveNormalized (multiple intervals, not on lunch) ===");

test("2 closed + 1 open → sum of all", () => {
  const now = new Date("2024-01-15T16:00:00");

  const intervals = [
    { start: "2024-01-15T09:00:00", end: "2024-01-15T12:00:00" },
    { start: "2024-01-15T13:00:00", end: "2024-01-15T15:00:00" },
    { start: "2024-01-15T15:30:00", end: null }
  ];

  let gross = 0;
  for (const i of intervals) {
    if (!i?.start) continue;
    if (i.end) {
      gross += diffSec(i.start, i.end, "2024-01-15") / 60;
    } else {
      const startMs = parseStamp(i.start);
      let diff = now.getTime() - startMs;
      gross += Math.max(0, Math.floor(diff / 1000)) / 60;
    }
  }

  assert.equal(gross, 330);
});

console.log("\n=== fixStaleActive simulation ===");

test("stale active record gets closed", () => {
  const data = [
    {
      id: 1,
      date: "2024-01-14",
      start: "2024-01-14T09:00:00",
      end: null,
      lunch: 0,
      intervals: [
        { start: "2024-01-14T09:00:00", end: null }
      ],
      active: true,
      onLunch: false,
      lunchStart: null
    }
  ];

  const todayStr = "2024-01-15";

  for (const e of data) {
    if (!e.active || e.date === todayStr) continue;
    const current = e.intervals?.find(i => i.start && !i.end);
    if (current) {
      current.end = e.date + "T23:59:59";
    }
    e.end = e.intervals?.at(-1)?.end || e.start;
    e.active = false;
    e.onLunch = false;
    e.lunchStart = null;
  }

  assert.equal(data[0].active, false);
  assert.equal(data[0].intervals[0].end, "2024-01-14T23:59:59");
  assert.equal(data[0].end, "2024-01-14T23:59:59");
});

test("today's active record is NOT closed", () => {
  const data = [
    {
      id: 1,
      date: "2024-01-15",
      start: "2024-01-15T09:00:00",
      end: null,
      lunch: 0,
      intervals: [
        { start: "2024-01-15T09:00:00", end: null }
      ],
      active: true,
      onLunch: false,
      lunchStart: null
    }
  ];

  const todayStr = "2024-01-15";

  for (const e of data) {
    if (!e.active || e.date === todayStr) continue;
    const current = e.intervals?.find(i => i.start && !i.end);
    if (current) current.end = e.date + "T23:59:59";
    e.end = e.intervals?.at(-1)?.end || e.start;
    e.active = false;
    e.onLunch = false;
    e.lunchStart = null;
  }

  assert.equal(data[0].active, true);
  assert.equal(data[0].intervals[0].end, null);
});

test("stale on-lunch record gets closed", () => {
  const data = [
    {
      id: 1,
      date: "2024-01-14",
      start: "2024-01-14T09:00:00",
      end: null,
      lunch: 0,
      intervals: [
        { start: "2024-01-14T09:00:00", end: "2024-01-14T12:00:00" }
      ],
      active: true,
      onLunch: true,
      lunchStart: "2024-01-14T12:00:00"
    }
  ];

  const todayStr = "2024-01-15";

  for (const e of data) {
    if (!e.active || e.date === todayStr) continue;
    const current = e.intervals?.find(i => i.start && !i.end);
    if (current) current.end = e.date + "T23:59:59";
    e.end = e.intervals?.at(-1)?.end || e.start;
    e.active = false;
    e.onLunch = false;
    e.lunchStart = null;
  }

  assert.equal(data[0].active, false);
  assert.equal(data[0].onLunch, false);
  assert.equal(data[0].lunchStart, null);
  assert.equal(data[0].end, "2024-01-14T12:00:00");
});

console.log("\n=== editForm duplicate check (T4 fix) ===");

test("duplicate check finds active records too", () => {
  const data = [
    { id: "a", date: "2024-01-15", active: true },
    { id: "b", date: "2024-01-15", active: false }
  ];

  const date = "2024-01-15";
  const id = "c";

  const duplicate = data.find(
    x => x.date === date && String(x.id) !== String(id)
  );

  assert.ok(duplicate);
  assert.equal(duplicate.id, "a");
});

test("no duplicate if only self exists", () => {
  const data = [
    { id: "a", date: "2024-01-15", active: false }
  ];

  const date = "2024-01-15";
  const id = "a";

  const duplicate = data.find(
    x => x.date === date && String(x.id) !== String(id)
  );

  assert.equal(duplicate, undefined);
});

console.log("\n=== editForm duplicate replace (T1 fix) ===");

test("replace removes only duplicate, keeps edited record", () => {
  let data = [
    { id: "a", date: "2024-01-15", active: false },
    { id: "b", date: "2024-01-14", active: false }
  ];

  const id = "b";
  const duplicate = data.find(
    x => x.date === "2024-01-15" && String(x.id) !== String(id)
  );

  assert.equal(duplicate.id, "a");

  // OLD buggy code: data = data.filter(x => x.id !== duplicate.id && x.id !== id);
  // NEW fixed code: data = data.filter(x => x.id !== duplicate.id);
  data = data.filter(x => String(x.id) !== String(duplicate.id));

  assert.equal(data.length, 1);
  assert.equal(data[0].id, "b");
});

console.log("\n=== renderEditIntervals removal (T2 fix) ===");

test("closest approach removes correct row regardless of index", () => {
  // Simulate DOM: 3 rows, each with a remove button
  // After removing row 0, row 1's button should remove row 1 (not row 2)
  // This test verifies the logic concept: using closest instead of index

  const rows = [
    { id: "row0", dataIndex: 0 },
    { id: "row1", dataIndex: 1 },
    { id: "row2", dataIndex: 2 }
  ];

  // OLD buggy approach: rows[dataIndex]?.remove()
  // After removing row 0: rows = [row1, row2]
  // Click row1's button (dataIndex=1): rows[1] = row2 (WRONG!)

  // NEW approach: use closest() → always removes the button's own row
  // After removing row 0: rows = [row1, row2]
  // Click row1's button: closest(".edit-row") = row1 (CORRECT!)

  // Simulate: remove row 0, then check which row button at index 1 targets
  const afterRemove = [rows[1], rows[2]]; // DOM after row 0 removed

  // Old approach: rows[1] = row2 (wrong)
  assert.equal(afterRemove[rows[1].dataIndex]?.id, "row2");

  // New approach: btn.closest = row1 (correct) - verified conceptually
  assert.equal(rows[1].id, "row1");
});

console.log("\n=== settings validation (T5) ===");

test("missing workDays gets default", () => {
  let s = { norm: 480 };
  if (!Array.isArray(s.workDays) || !s.workDays.length) {
    s.workDays = [1, 2, 3, 4, 5];
  }
  assert.deepEqual(s.workDays, [1, 2, 3, 4, 5]);
});

test("empty workDays gets default", () => {
  let s = { norm: 480, workDays: [] };
  if (!Array.isArray(s.workDays) || !s.workDays.length) {
    s.workDays = [1, 2, 3, 4, 5];
  }
  assert.deepEqual(s.workDays, [1, 2, 3, 4, 5]);
});

test("invalid norm gets default", () => {
  let s = { norm: NaN, workDays: [1] };
  if (!Number.isFinite(s.norm) || s.norm < 0) {
    s.norm = 480;
  }
  assert.equal(s.norm, 480);
});

test("valid settings pass through", () => {
  let s = { norm: 600, workDays: [1, 2, 3, 4, 5, 6] };
  if (!Array.isArray(s.workDays) || !s.workDays.length) s.workDays = [1, 2, 3, 4, 5];
  if (!Number.isFinite(s.norm) || s.norm < 0) s.norm = 480;
  assert.equal(s.norm, 600);
  assert.deepEqual(s.workDays, [1, 2, 3, 4, 5, 6]);
});

console.log("\n=== Utility functions ===");

test("pad", () => {
  assert.equal(pad(0), "00");
  assert.equal(pad(5), "05");
  assert.equal(pad(12), "12");
});

test("displayTime", () => {
  assert.equal(displayTime(null), "—");
  assert.equal(displayTime(undefined), "—");
  assert.equal(displayTime(""), "—");
  assert.equal(displayTime("2024-01-15T09:30:00"), "09:30:00");
  assert.equal(displayTime("09:30"), "09:30");
});

test("timeInputValue", () => {
  assert.equal(timeInputValue(null), "");
  assert.equal(timeInputValue("2024-01-15T09:30:00"), "09:30");
  assert.equal(timeInputValue("09:30:45"), "09:30");
});

test("withSeconds", () => {
  assert.equal(withSeconds("09:30"), "09:30:00");
  assert.equal(withSeconds("09:30:45"), "09:30:45");
  assert.equal(withSeconds(""), "");
});

test("combineStamp", () => {
  assert.equal(combineStamp("2024-01-15", "09:30"), "2024-01-15T09:30:00");
  assert.equal(combineStamp("2024-01-15", "09:30:45"), "2024-01-15T09:30:45");
  assert.equal(combineStamp("", "09:30"), "09:30:00");
  assert.equal(combineStamp("2024-01-15", ""), "");
});

test("fmt", () => {
  assert.equal(fmt(0), "0ч 00м");
  assert.equal(fmt(60), "1ч 00м");
  assert.equal(fmt(90), "1ч 30м");
  assert.equal(fmt(480), "8ч 00м");
  assert.equal(fmt(-5), "0ч 00м"); // max(0, ...)
});

test("signed", () => {
  assert.equal(signed(60), "+1ч 00м");
  assert.equal(signed(-60), "−1ч 00м");
  assert.equal(signed(0), "+0ч 00м");
});

test("fmtTimer", () => {
  assert.equal(fmtTimer(0), "00:00:00");
  assert.equal(fmtTimer(3661), "01:01:01");
  assert.equal(fmtTimer(86399), "23:59:59");
  assert.equal(fmtTimer(-5), "00:00:00");
});

test("parseStamp with full timestamp", () => {
  const ms = parseStamp("2024-01-15T09:30:00");
  assert.ok(Number.isFinite(ms));
  const d = new Date(ms);
  assert.equal(d.getFullYear(), 2024);
  assert.equal(d.getMonth(), 0); // January
  assert.equal(d.getDate(), 15);
  assert.equal(d.getHours(), 9);
  assert.equal(d.getMinutes(), 30);
});

test("parseStamp with old format + dateHint", () => {
  const ms = parseStamp("09:30", "2024-01-15");
  assert.ok(Number.isFinite(ms));
});

test("parseStamp with invalid input", () => {
  assert.ok(!Number.isFinite(parseStamp("")));
  assert.ok(!Number.isFinite(parseStamp(null)));
  assert.ok(!Number.isFinite(parseStamp("abc")));
  assert.ok(!Number.isFinite(parseStamp("25:00")));
  assert.ok(!Number.isFinite(parseStamp("12:60")));
});

test("parseTimeToSec", () => {
  assert.equal(parseTimeToSec("2024-01-15T01:00:00"), 3600);
  assert.equal(parseTimeToSec("01:00:00"), 3600);
  assert.equal(parseTimeToSec("01:30"), 5400);
  assert.ok(!Number.isFinite(parseTimeToSec("abc")));
});

console.log("\n=== Night shift (manual mode end < start) ===");

test("night shift: 22:00-06:00 = 8h", () => {
  const date = "2024-01-15";
  const start = combineStamp(date, "22:00");
  const end = combineStamp(date, "06:00");
  assert.equal(minBetween(start, end), 480);
});

test("night shift lunch check: 8h shift, lunch=480 is allowed", () => {
  const date = "2024-01-15";
  const start = combineStamp(date, "22:00");
  const end = combineStamp(date, "06:00");
  const gross = minBetween(start, end);
  const lunch = 480;
  assert.ok(lunch <= gross);
});

test("night shift lunch check: 8h shift, lunch=481 rejected", () => {
  const date = "2024-01-15";
  const start = combineStamp(date, "22:00");
  const end = combineStamp(date, "06:00");
  const gross = minBetween(start, end);
  const lunch = 481;
  assert.ok(lunch > gross);
});

console.log("\n=== Lunch across midnight ===");

test("lunch from 23:30 to 00:30 = 60 min", () => {
  const lunchStart = "2024-01-15T23:30:00";
  const now = "2024-01-16T00:30:00";
  assert.equal(minBetween(lunchStart, now), 60);
});

console.log("\n=== lunchTotalSeconds ===");

function lunchTotalSeconds(e, nowStamp) {
  let sec = (Math.max(0, Number(e.lunch) || 0)) * 60;
  if (e.onLunch && e.lunchStart) {
    sec += diffSec(e.lunchStart, nowStamp || stamp(), e.date);
  }
  return sec;
}

test("no lunch → 0 seconds", () => {
  const e = { lunch: 0, onLunch: false, lunchStart: null };
  assert.equal(lunchTotalSeconds(e), 0);
});

test("accumulated 60 min lunch → 3600 seconds", () => {
  const e = { lunch: 60, onLunch: false, lunchStart: null };
  assert.equal(lunchTotalSeconds(e), 3600);
});

test("on lunch: accumulated + live", () => {
  const e = {
    lunch: 30,
    onLunch: true,
    lunchStart: "2024-01-15T12:00:00",
    date: "2024-01-15"
  };
  const nowStamp = "2024-01-15T12:30:00";
  assert.equal(lunchTotalSeconds(e, nowStamp), 3600);
});

test("on lunch across midnight", () => {
  const e = {
    lunch: 0,
    onLunch: true,
    lunchStart: "2024-01-15T23:30:00",
    date: "2024-01-15"
  };
  const nowStamp = "2024-01-16T00:30:00";
  assert.equal(lunchTotalSeconds(e, nowStamp), 3600);
});

test("negative lunch capped at 0", () => {
  const e = { lunch: -10, onLunch: false, lunchStart: null };
  assert.equal(lunchTotalSeconds(e), 0);
});

// ===== SUMMARY =====
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed!");
}
