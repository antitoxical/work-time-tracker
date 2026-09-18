import { displayTime, fmtTimer } from "./utils.js";
import { getSettings } from "./storage.js";
import { diffSec, minBetween, elapsedFromStart, stamp } from "./time.js";

export function liveTimerSeconds(e) {
  let totalSec = 0;

  for (const iv of e.intervals || []) {
    if (!iv?.start) continue;

    if (iv.end) {
      totalSec += diffSec(iv.start, iv.end, e.date);
    } else if (!e.onLunch) {
      totalSec += elapsedFromStart(iv.start);
    }
  }

  return Math.max(0, totalSec);
}

export function lunchTotalSeconds(e) {
  let sec = (Math.max(0, Number(e.lunch) || 0)) * 60;

  if (e.onLunch && e.lunchStart) {
    sec += diffSec(e.lunchStart, stamp(), e.date);
  }

  return sec;
}

export function normalize(e) {
  const settings = getSettings();

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

export function liveNormalized(e) {
  const ints = [...(e.intervals || [])];
  let gross = 0;

  for (const i of ints) {
    if (!i?.start) continue;

    if (i.end) {
      gross += diffSec(i.start, i.end, e.date) / 60;
    } else {
      gross += e.onLunch
        ? 0
        : elapsedFromStart(i.start) / 60;
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

export function requiredMinutes(a, b) {
  const settings = getSettings();
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