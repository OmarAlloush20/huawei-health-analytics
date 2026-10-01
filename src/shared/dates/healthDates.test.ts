import { addLocalDays, enumerateLocalDates, getLocalDayWindow, toLocalDate } from './healthDates';

describe('health date utilities', () => {
  test('enumerates inclusive local calendar dates', () => {
    expect(enumerateLocalDates({ start: '2026-02-27', end: '2026-03-02', timeZone: 'UTC' })).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
    expect(addLocalDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  test('rejects impossible dates and reversed ranges', () => {
    expect(() => addLocalDays('2026-02-30', 1)).toThrow('Invalid local date');
    expect(() => enumerateLocalDates({ start: '2026-03-02', end: '2026-03-01', timeZone: 'UTC' })).toThrow('start must be');
  });

  test('creates DST-aware local-day boundaries', () => {
    const window = getLocalDayWindow('2026-03-08', 'America/New_York');
    expect(new Date(window.endTimeExclusive).getTime() - new Date(window.startTime).getTime()).toBe(23 * 60 * 60 * 1000);
    expect(toLocalDate(new Date(window.startTime), 'America/New_York')).toBe('2026-03-08');
  });
});
