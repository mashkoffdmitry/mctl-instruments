import type { SessionCalendar, SessionState, Weekday } from './types.ts';

// DST-aware session derivation from a structured calendar. No external deps:
// uses Intl to read/convert wall-clock in the schedule's IANA timezone.

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_MS = 86_400_000;

// Offset (ms) such that: localWallClockAsUTC = instant + offset.
function offsetMs(instantMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(new Date(instantMs))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  const asUTC = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asUTC - instantMs;
}

// Convert a wall-clock date+time in `tz` to a UTC instant (ms), DST-safe.
function localToUtc(year: number, month: number, day: number, hh: number, mm: number, tz: string): number {
  const guess = Date.UTC(year, month - 1, day, hh, mm);
  const o1 = offsetMs(guess, tz);
  let utc = guess - o1;
  const o2 = offsetMs(utc, tz);
  if (o2 !== o1) utc = guess - o2;
  return utc;
}

interface TzDate {
  y: number;
  mo: number;
  d: number;
  weekday: Weekday;
  dateStr: string;
}

function tzDateOf(instantMs: number, tz: string): TzDate {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(instantMs))) {
    if (part.type !== 'literal') p[part.type] = part.value;
  }
  const y = Number(p.year);
  const mo = Number(p.month);
  const d = Number(p.day);
  return { y, mo, d, weekday: p.weekday!.toLowerCase().slice(0, 3) as Weekday, dateStr: `${p.year}-${p.month}-${p.day}` };
}

function parseHM(hm: string): [number, number] {
  const [h, m] = hm.split(':');
  return [Number(h), Number(m)];
}

interface Window {
  openMs: number;
  closeMs: number;
  holiday: boolean;
}

export interface SessionResult {
  session_state: SessionState;
  next_open_at: string | null;
  next_close_at: string | null;
}

function iso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

type CalendarInput = Pick<SessionCalendar, 'schedule_timezone' | 'regular_intervals' | 'holiday_exceptions'>;

export function computeSession(cal: CalendarInput, nowMs: number): SessionResult {
  const tz = cal.schedule_timezone || 'UTC';
  const holidaysByDate = new Map(cal.holiday_exceptions.map((h) => [h.date, h]));
  const windows: Window[] = [];

  // Scan from yesterday through +8 days to catch in-progress and upcoming sessions.
  for (let offset = -1; offset <= 8; offset++) {
    const probe = tzDateOf(nowMs + offset * DAY_MS, tz);
    const holiday = holidaysByDate.get(probe.dateStr);
    if (holiday?.is_closed) continue; // fully closed that day
    for (const itv of cal.regular_intervals) {
      if (itv.day !== probe.weekday) continue;
      const [oh, om] = parseHM(itv.open);
      const closeStr = holiday?.early_close ?? itv.close;
      const [ch, cm] = parseHM(closeStr);
      const openMs = localToUtc(probe.y, probe.mo, probe.d, oh, om, tz);
      const closeMs = localToUtc(probe.y, probe.mo, probe.d, ch, cm, tz);
      if (closeMs > openMs) windows.push({ openMs, closeMs, holiday: !!holiday });
    }
  }
  windows.sort((a, b) => a.openMs - b.openMs);

  const todayHasHoliday = holidaysByDate.has(tzDateOf(nowMs, tz).dateStr);
  const current = windows.find((w) => nowMs >= w.openMs && nowMs <= w.closeMs);

  if (current) {
    return {
      session_state: current.holiday ? 'holiday' : 'open',
      next_open_at: null,
      next_close_at: iso(current.closeMs),
    };
  }
  const nextOpen = windows.find((w) => w.openMs > nowMs);
  return {
    session_state: todayHasHoliday ? 'holiday' : 'closed',
    next_open_at: nextOpen ? iso(nextOpen.openMs) : null,
    next_close_at: null,
  };
}

export { WEEKDAYS };
