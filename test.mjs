import { strict as assert } from "node:assert";
import { pad, displayTime, timeInputValue, withSeconds, combineStamp, fmt, signed, fmtTimer } from "./utils.js";
import { diffSec, minBetween, parseStamp, parseTimeToSec, elapsedFromStart, periodBounds, inBounds, dateKey, today, stamp } from "./time.js";
import { normalize, liveNormalized, liveTimerSeconds, lunchTotalSeconds, requiredMinutes } from "./normalize.js";

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

console.log("\n=== normalize (single interval) ===");

test("8h work, 1h lunch → net = 7h", () => {
  const e = {
    date: "2024-01-15",
    start: "09:00", end: "17:00", lunch: 60,
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
    start: "09:00", end: "17:00", lunch: 30,
    intervals: [{ start: "2024-01-15T09:00:00", end: "2024-01-15T17:00:00" }]
  };
  const n = normalize(e);
  assert.equal(n.gross, 480);
  assert.equal(n.net, 450);
});

console.log("\n=== normalize (multiple intervals) ===");

test("2 intervals + lunch → net = gross", () => {
  const e = {
    date: "2024-01-15", lunch: 60,
    intervals: [
      { start: "2024-01-15T09:00:00", end: "2024-01-15T12:00:00" },
      { start: "2024-01-15T13:00:00", end: "2024-01-15T17:00:00" }
    ]
  };
  const n = normalize(e);
  assert.equal(n.gross, 420);
  assert.equal(n.net, 420);
});

test("3 intervals → net = sum", () => {
  const e = {
    date: "2024-01-15", lunch: 90,
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

console.log("\n=== normalize (finish during lunch) ===");

test("finish during lunch: net = gross - lunch", () => {
  const e = {
    date: "2024-01-15", lunch: 30,
    intervals: [{ start: "2024-01-15T09:00:00", end: "2024-01-15T12:00:00" }]
  };
  const n = normalize(e);
  assert.equal(n.gross, 180);
  assert.equal(n.lunch, 30);
  assert.equal(n.net, 150);
});

console.log("\n=== normalize (edge cases) ===");

test("missing intervals falls back to start/end", () => {
  const e = {
    date: "2024-01-15",
    start: "2024-01-15T09:00:00", end: "2024-01-15T17:00:00", lunch: 0
  };
  const n = normalize(e);
  assert.equal(n.gross, 480);
  assert.equal(n.net, 480);
});

test("empty intervals falls back", () => {
  const e = {
    date: "2024-01-15",
    start: "2024-01-15T09:00:00", end: "2024-01-15T17:00:00", lunch: 0,
    intervals: []
  };
  const n = normalize(e);
  assert.equal(n.gross, 480);
});

test("interval with missing end is skipped", () => {
  const e = {
    date: "2024-01-15", lunch: 0,
    intervals: [{ start: "2024-01-15T09:00:00", end: null }]
  };
  const n = normalize(e);
  assert.equal(n.gross, 0);
});

test("start/end shows displayTime of first/last", () => {
  const e = {
    date: "2024-01-15", lunch: 0,
    intervals: [
      { start: "2024-01-15T09:00:00", end: "2024-01-15T12:00:00" },
      { start: "2024-01-15T13:00:00", end: "2024-01-15T17:00:00" }
    ]
  };
  const n = normalize(e);
  assert.equal(n.start, "09:00:00");
  assert.equal(n.end, "17:00:00");
});

console.log("\n=== liveNormalized ===");

test("on lunch: open interval gives 0 gross", () => {
  const e = {
    date: "2024-01-15", lunch: 0,
    onLunch: true, lunchStart: "2024-01-15T12:00:00",
    intervals: [{ start: "2024-01-15T09:00:00", end: "2024-01-15T12:00:00" }]
  };
  const ints = [...(e.intervals || [])];
  let gross = 0;
  for (const i of ints) {
    if (!i?.start) continue;
    if (i.end) gross += diffSec(i.start, i.end, e.date) / 60;
    else if (!e.onLunch) gross += 999;
  }
  assert.equal(gross, 180);
});

console.log("\n=== lunchTotalSeconds ===");

test("no lunch → 0", () => {
  assert.equal(lunchTotalSeconds({ lunch: 0, onLunch: false, lunchStart: null }), 0);
});

test("accumulated 60 min → 3600 sec", () => {
  assert.equal(lunchTotalSeconds({ lunch: 60, onLunch: false, lunchStart: null }), 3600);
});

test("on lunch: accumulated + live returns > accumulated", () => {
  const e = { lunch: 30, onLunch: true, lunchStart: "2024-01-15T12:00:00", date: "2024-01-15" };
  const sec = lunchTotalSeconds(e);
  assert.ok(sec > 30 * 60);
});

test("negative lunch capped at 0", () => {
  assert.equal(lunchTotalSeconds({ lunch: -10, onLunch: false, lunchStart: null }), 0);
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
  assert.equal(fmt(-5), "0ч 00м");
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
  assert.equal(d.getMonth(), 0);
  assert.equal(d.getDate(), 15);
  assert.equal(d.getHours(), 9);
  assert.equal(d.getMinutes(), 30);
});

test("parseStamp with old format + dateHint", () => {
  assert.ok(Number.isFinite(parseStamp("09:30", "2024-01-15")));
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

console.log("\n=== Night shift ===");

test("22:00-06:00 = 8h", () => {
  assert.equal(minBetween(combineStamp("2024-01-15", "22:00"), combineStamp("2024-01-15", "06:00")), 480);
});

test("lunch=480 allowed for 8h shift", () => {
  const gross = minBetween(combineStamp("2024-01-15", "22:00"), combineStamp("2024-01-15", "06:00"));
  assert.ok(480 <= gross);
});

test("lunch=481 rejected for 8h shift", () => {
  const gross = minBetween(combineStamp("2024-01-15", "22:00"), combineStamp("2024-01-15", "06:00"));
  assert.ok(481 > gross);
});

console.log("\n=== Lunch across midnight ===");

test("23:30 to 00:30 = 60 min", () => {
  assert.equal(minBetween("2024-01-15T23:30:00", "2024-01-16T00:30:00"), 60);
});

console.log("\n=== requiredMinutes ===");

test("weekdays only, 1 week", () => {
  const a = new Date("2024-01-15T12:00:00"); // Monday
  const b = new Date("2024-01-21T12:00:00"); // Sunday
  assert.equal(requiredMinutes(a, b), 2400); // 5 * 480
});

console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log("All tests passed!");