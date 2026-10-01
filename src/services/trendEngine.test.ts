import type { DailyHealthSummary } from '../models/health';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../providers/mock/mockHealthData';
import { addLocalDays, localDateTimeToIso } from '../shared/dates/healthDates';
import { calculateDailyBaselines } from './baselineEngine';
import { calculateRecovery } from './recoveryEngine';
import { buildTrendReport, TREND_CONFIG } from './trendEngine';

function history(scenario: Parameters<typeof createMockHealthData>[0] = 'balanced'): DailyHealthSummary[] {
  const data = createMockHealthData(scenario, { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  if (data.dailySummaries.status !== 'available') throw new Error('Expected history');
  return data.dailySummaries.value;
}

describe('trend engine', () => {
  test.each([
    ['7d', 7, '2026-09-24', '2026-09-17', '2026-09-23'],
    ['30d', 30, '2026-09-01', '2026-08-02', '2026-08-31'],
    ['90d', 90, '2026-07-03', '2026-04-04', '2026-07-02'],
  ] as const)('builds exact inclusive %s ranges', (range, days, start, previousStart, previousEnd) => {
    const report = buildTrendReport(range, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, history());
    expect(report).toMatchObject({ days, startDate: start, endDate: MOCK_ANCHOR_DATE, previousStartDate: previousStart, previousEndDate: previousEnd });
    expect(report.series.recovery.points).toHaveLength(days);
    expect(report.series.steps.points).toHaveLength(days);
  });

  test('keeps missing calendar days and unavailable metrics as chart gaps', () => {
    const source = history('missing-data').filter((item) => item.date !== '2026-09-27');
    const report = buildTrendReport('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, source);
    expect(report.series.steps.points.find((point) => point.date === '2026-09-27')).toEqual({ date: '2026-09-27', status: 'not-recorded' });
    expect(report.series['hrv-rmssd'].points.some((point) => point.status === 'missing')).toBe(true);
    expect(report.series['hrv-rmssd'].points).toHaveLength(7);
  });

  test('calculates each historical Recovery value from only its preceding history', () => {
    const source = history();
    const report = buildTrendReport('30d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, source);
    const date = '2026-09-15';
    const current = source.find((item) => item.date === date)!;
    const preceding = source.filter((item) => item.date >= addLocalDays(date, -28) && item.date < date);
    const expected = calculateRecovery(calculateDailyBaselines(preceding, current, date, MOCK_TIME_ZONE)).score;
    expect(report.series.recovery.points.find((point) => point.date === date)?.value).toBe(expected);
  });

  test('future/current-day changes cannot alter earlier historical Recovery', () => {
    const source = history();
    const original = buildTrendReport('30d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, source);
    const last = source.at(-1)!;
    const changed = source.map((item) => item.date === last.date && item.hrv.status === 'available'
      ? { ...item, hrv: { ...item.hrv, value: { ...item.hrv.value, averageRmssdMs: 999 } } }
      : item);
    const next = buildTrendReport('30d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, changed);
    expect(next.series.recovery.points.slice(0, -1)).toEqual(original.series.recovery.points.slice(0, -1));
  });

  test('uses configured aggregation and materiality for period comparisons', () => {
    const poorSleep = buildTrendReport('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, history('poor-sleep'));
    const strained = buildTrendReport('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, history('low-hrv-elevated-rhr'));
    const highActivity = buildTrendReport('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, history('high-activity'));
    expect(poorSleep.series['sleep-duration'].comparison).toMatchObject({ direction: 'decreasing', material: true });
    expect(strained.series['hrv-rmssd'].comparison).toMatchObject({ direction: 'decreasing', material: true });
    expect(strained.series['resting-heart-rate'].comparison).toMatchObject({ direction: 'increasing', material: true });
    expect(highActivity.series.steps.comparison).toMatchObject({ direction: 'increasing', material: true });
  });

  test('classifies tiny changes as stable rather than manufacturing a headline', () => {
    const source = history();
    const report = buildTrendReport('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, source);
    expect(['stable', 'increasing', 'decreasing']).toContain(report.series.steps.comparison.direction);
    expect(TREND_CONFIG.materiality).toEqual({ recoveryPoints: 5, sleepMinutes: 20, hrvPercent: 5, restingHeartRateBpm: 2, stepsPercent: 10, stepsAbsolute: 500, sleepConsistencyMinutes: 15 });
  });

  test('suppresses comparisons when either period has sparse coverage', () => {
    const source = history().filter((item) => item.date >= '2026-09-27');
    const report = buildTrendReport('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, source);
    expect(report.series.steps.comparison).toEqual({ direction: 'insufficient-data', material: false, reason: 'sparse-previous-period' });
  });

  test('calculates bedtime consistency with circular midnight-aware math', () => {
    const source = history();
    const changed = source.map((item) => {
      if (item.sleep.status !== 'available') return item;
      const daysAgo = Number(MOCK_ANCHOR_DATE.slice(-2)) - Number(item.date.slice(-2));
      if (daysAgo < 0 || daysAgo > 13) return item;
      const hour = daysAgo <= 6 ? (daysAgo % 2 === 0 ? 23 : 0) : (daysAgo % 2 === 0 ? 22 : 1);
      const minute = daysAgo <= 6 ? (daysAgo % 2 === 0 ? 58 : 2) : 0;
      return { ...item, sleep: { ...item.sleep, value: { ...item.sleep.value, bedtime: localDateTimeToIso(item.date, MOCK_TIME_ZONE, hour, minute) } } };
    });
    const result = buildTrendReport('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, changed).sleepConsistency;
    expect(result.status).toBe('available');
    expect(result.direction).toBe('improving');
    expect(result.currentMeanDeviationMinutes).toBeLessThan(result.previousMeanDeviationMinutes!);
  });

  test('is deterministic and preserves source time-zone filtering', () => {
    const source = history();
    expect(buildTrendReport('30d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, source)).toEqual(buildTrendReport('30d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, source));
    expect(buildTrendReport('7d', MOCK_ANCHOR_DATE, 'UTC', source).series.steps.availableDays).toBe(0);
  });
});
