import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../../providers/mock/mockHealthData';
import { contributionContext, contributionWeight, formatSelectedDate, getTodayRecoveryLayout, readingPoints } from './todayPresentation';
import type { RecoverySignalContribution } from '../../models/recovery';

describe('Today presentation', () => {
  test.each([360, 390, 412, 480, 768])('compact daily Recovery at %idp retains a real copy allowance and stacks for enlarged text', (width) => {
    const layout = getTodayRecoveryLayout(width, 1);
    expect(layout.stack).toBe(false);
    const available = Math.min(width, 720) - (width < 390 ? 32 : 48) - 32;
    expect(available - layout.gauge - 12).toBeGreaterThanOrEqual(150);
    expect(getTodayRecoveryLayout(width, 1.2).stack).toBe(true);
    expect(getTodayRecoveryLayout(width, 2).contributorsStack).toBe(true);
  });
  test.each([1.05, 1.1, 1.15])('360dp budgets the actual scaled gauge and copy at %sx text', (fontScale) => {
    expect(getTodayRecoveryLayout(360, fontScale).stack).toBe(true);
    expect(getTodayRecoveryLayout(768, fontScale).stack).toBe(false);
  });
  test.each([360, 390, 412, 768])('uses a complete abbreviated date at %i dp without truncation', (width) => {
    expect(formatSelectedDate('2026-09-30', width, 1)).toContain('Sep 30');
    expect(formatSelectedDate('2026-09-30', width, 1.5)).toBe('Sep 30');
  });
  test('builds real seven-day signal observations and retains missing days', () => {
    const data = createMockHealthData('missing-data', { start: '2026-09-24', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
    if (data.dailySummaries.status !== 'available') throw new Error('Fixture missing');
    const points = readingPoints('stress', data.dailySummaries.value, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
    expect(points).toHaveLength(7);
    expect(points.some((point) => point.status !== 'available')).toBe(true);
    const actual = data.dailySummaries.value.find((summary) => summary.date === points[0].date)?.stress;
    if (actual?.status === 'available') expect(points[0].value).toBe(actual.value.averageIndex);
  });
  test('does not infer a direction when the selected reading is missing', () => {
    const contribution: RecoverySignalContribution = { signal: 'hrv-rmssd', status: 'today-unavailable', currentStatus: 'missing', configuredWeight: 0.4, baselineStatus: 'ready', unit: 'ms', lowerBound: 40, upperBound: 50, baselineCenter: 45, reason: 'No reading' };
    expect(contributionContext(contribution)).toBe('Usual 40–50 ms · baseline 45 ms · No usable reading');
    expect(contributionContext(contribution)).not.toContain('above range');
  });
  test('distinguishes unchanged model weights from partial applied weights', () => {
    const contribution: RecoverySignalContribution = { signal: 'hrv-rmssd', status: 'used', currentStatus: 'available', configuredWeight: 0.4, normalizedWeight: 0.4 / 0.65, baselineStatus: 'ready', unit: 'ms', reason: 'Within range' };
    expect(contributionWeight(contribution)).toBe('40% model · 61.5% applied');
    expect(contributionWeight({ ...contribution, normalizedWeight: 0.4 })).toBe('40% model');
  });
});
