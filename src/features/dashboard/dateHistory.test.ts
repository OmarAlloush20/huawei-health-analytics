import { buildCalendarMonth, getDateNavigation, moveCalendarMonth, nearestAvailableDate } from './dateHistory';

describe('date history helpers', () => {
  test.each(['en', 'ar'] as const)('%s preserves earlier/later semantics with explicit reading-direction arrows', (language) => {
    const navigation = getDateNavigation(language);
    expect(navigation.previous.offset).toBe(-1);
    expect(navigation.next.offset).toBe(1);
    expect(navigation.direction).toBe(language === 'ar' ? 'rtl' : 'ltr');
    expect(navigation.previous.glyph).toBe(language === 'ar' ? '›' : '‹');
    expect(navigation.next.glyph).toBe(language === 'ar' ? '‹' : '›');
  });
  test('builds a complete Sunday-first six-week month grid', () => {
    const days = buildCalendarMonth('2026-09');
    expect(days).toHaveLength(42);
    expect(days[0]).toEqual({ date: '2026-08-30', day: 30, inMonth: false });
    expect(days.find((day) => day.date === '2026-09-30')?.inMonth).toBe(true);
  });

  test('moves across year boundaries', () => {
    expect(moveCalendarMonth('2026-01', -1)).toBe('2025-12');
    expect(moveCalendarMonth('2026-12', 1)).toBe('2027-01');
  });

  test('uses an exact available date or the nearest recorded day', () => {
    const dates = ['2026-09-01', '2026-09-03', '2026-09-08'];
    expect(nearestAvailableDate('2026-09-03', dates)).toBe('2026-09-03');
    expect(nearestAvailableDate('2026-09-06', dates)).toBe('2026-09-08');
    expect(nearestAvailableDate('2026-09-06', [])).toBeNull();
  });
});
