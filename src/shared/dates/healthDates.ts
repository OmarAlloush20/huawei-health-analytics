import type { DateRange, LocalDate } from '../../models/health';

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLocalDate(value: string): Date {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) throw new Error(`Invalid local date: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid local date: ${value}`);
  }
  return date;
}

export function addLocalDays(value: LocalDate, amount: number): LocalDate {
  const date = parseLocalDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function enumerateLocalDates(range: DateRange): LocalDate[] {
  const start = parseLocalDate(range.start);
  const end = parseLocalDate(range.end);
  if (start > end) throw new Error('Date range start must be on or before its end.');
  const dates: LocalDate[] = [];
  for (let date = range.start; date <= range.end; date = addLocalDays(date, 1)) dates.push(date);
  return dates;
}

export function getSystemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function toLocalDate(date: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  const representedUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  return representedUtc - date.getTime();
}

export function localDateTimeToIso(date: LocalDate, timeZone: string, hour = 0, minute = 0): string {
  const parsed = parseLocalDate(date);
  const wallClockUtc = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), hour, minute);
  let instant = new Date(wallClockUtc);
  instant = new Date(wallClockUtc - getTimeZoneOffsetMilliseconds(instant, timeZone));
  instant = new Date(wallClockUtc - getTimeZoneOffsetMilliseconds(instant, timeZone));
  return instant.toISOString();
}

export function getLocalDayWindow(date: LocalDate, timeZone: string) {
  parseLocalDate(date);
  return {
    startTime: localDateTimeToIso(date, timeZone),
    endTimeExclusive: localDateTimeToIso(addLocalDays(date, 1), timeZone),
  };
}
