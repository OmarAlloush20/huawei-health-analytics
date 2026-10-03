import type { LocalDate } from '../../models/health';
import type { AppLanguage } from '../../localization/resources';

/** Earlier is at reading-start (right in Arabic), not an unlabeled physical left. */
export function getDateNavigation(language: AppLanguage) {
  return { direction: language === 'ar' ? 'rtl' as const : 'ltr' as const,
    previous: { offset: -1, glyph: language === 'ar' ? '›' : '‹' },
    next: { offset: 1, glyph: language === 'ar' ? '‹' : '›' } };
}

export interface CalendarDay {
  date: LocalDate;
  day: number;
  inMonth: boolean;
}

export function buildCalendarMonth(month: string): CalendarDay[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => {
    const value = new Date(start);
    value.setUTCDate(value.getUTCDate() + index);
    const date = value.toISOString().slice(0, 10);
    return { date, day: value.getUTCDate(), inMonth: value.getUTCMonth() === monthNumber - 1 };
  });
}

export function moveCalendarMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return next.toISOString().slice(0, 7);
}

export function nearestAvailableDate(requested: LocalDate, availableDates: readonly LocalDate[]): LocalDate | null {
  if (!availableDates.length) return null;
  if (availableDates.includes(requested)) return requested;
  return [...availableDates].sort((a, b) => {
    const distance = Math.abs(new Date(`${a}T12:00:00Z`).getTime() - new Date(`${requested}T12:00:00Z`).getTime()) - Math.abs(new Date(`${b}T12:00:00Z`).getTime() - new Date(`${requested}T12:00:00Z`).getTime());
    return distance || b.localeCompare(a);
  })[0];
}
