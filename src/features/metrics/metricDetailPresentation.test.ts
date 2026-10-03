import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../../providers/mock/mockHealthData';
import type { DashboardDayData } from '../../services/DashboardDataService';
import { calculateDailyBaselines } from '../../services/baselineEngine';
import { calculateRecovery } from '../../services/recoveryEngine';
import { addLocalDays } from '../../shared/dates/healthDates';
import { formatDetailValue, getSelectedDayPresentation, retainSelectedDate } from './metricDetailPresentation';

describe('historical metric presentation', () => {
  test.each([7, 30, 90])('keeps a selected historical day inside a %i-day period', (days) => {
    const points = Array.from({ length: days }, (_, index) => ({ date: addLocalDays(MOCK_ANCHOR_DATE, index - days + 1), status: 'available' as const, value: index }));
    expect(retainSelectedDate(points[0].date, points, MOCK_ANCHOR_DATE)).toBe(points[0].date);
    expect(retainSelectedDate(addLocalDays(points[0].date, -1), points, MOCK_ANCHOR_DATE)).toBe(MOCK_ANCHOR_DATE);
  });

  test('historical recovery explanation and HRV reference come from the selected day', () => {
    const source = createMockHealthData('low-hrv-elevated-rhr', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
    if (source.dailySummaries.status !== 'available') throw new Error('Expected mock summaries');
    for (const date of [addLocalDays(MOCK_ANCHOR_DATE, -14), MOCK_ANCHOR_DATE]) {
      const summary = source.dailySummaries.value.find((item) => item.date === date);
      if (!summary) throw new Error('Expected selected day');
      const prior = source.dailySummaries.value.filter((item) => item.date >= addLocalDays(date, -28) && item.date < date);
      const baselines = calculateDailyBaselines(prior, summary, date, MOCK_TIME_ZONE);
      const recovery = calculateRecovery(baselines);
      const day: DashboardDayData = { summary, baselines, recovery, insight: null };
      const recoveryView = getSelectedDayPresentation('recovery', day);
      const hrvView = getSelectedDayPresentation('hrv', day);
      expect(recoveryView?.view.date).toBe(date);
      expect(recoveryView?.context).toBe(recovery.explanation);
      expect(hrvView?.view.date).toBe(date);
      expect(hrvView?.display.value).toBe(summary.hrv.status === 'available' ? String(summary.hrv.value.averageRmssdMs) : 'No data');
      expect(baselines.hrv.historyEndDate < date).toBe(true);
    }
  });

  test('missing day is not replaced with the nearest recorded day', () => {
    expect(getSelectedDayPresentation('recovery', { summary: null, baselines: null, recovery: null, insight: null })).toBeNull();
    expect(retainSelectedDate('2026-09-29', [{ date: '2026-09-29', status: 'not-recorded' }], MOCK_ANCHOR_DATE)).toBe('2026-09-29');
    expect(formatDetailValue('hrv', undefined)).toBe('No reading');
  });

  test('formats sleep as duration and preserves true metric units', () => {
    expect(formatDetailValue('sleep', 437)).toBe('7h 17m');
    expect(formatDetailValue('spo2', 96.9)).toBe('96.9%');
    expect(formatDetailValue('rhr', 64)).toBe('64 bpm');
  });
});
