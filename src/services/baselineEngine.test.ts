import type { DailyHealthSummary, HeartRateDailySummary, HrvDailySummary, SleepDailySummary } from '../models/health';
import { failedMetric, missingMetric, unsupportedMetric } from '../models/healthMetrics';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../providers/mock/mockHealthData';
import { addLocalDays } from '../shared/dates/healthDates';
import { BASELINE_METHOD, calculateDailyBaselines } from './baselineEngine';

function summaries(scenario: Parameters<typeof createMockHealthData>[0], days = 29): DailyHealthSummary[] {
  const data = createMockHealthData(scenario, {
    start: addLocalDays(MOCK_ANCHOR_DATE, -(days - 1)),
    end: MOCK_ANCHOR_DATE,
    timeZone: MOCK_TIME_ZONE,
  });
  if (data.dailySummaries.status !== 'available') throw new Error('Expected available summaries');
  return data.dailySummaries.value;
}

function calculate(source = summaries('balanced')) {
  const current = source.find((item) => item.date === MOCK_ANCHOR_DATE);
  if (!current) throw new Error('Expected current summary');
  return calculateDailyBaselines(source, current, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
}

describe('personal baseline engine', () => {
  test('uses a 28-day lookback and excludes the evaluated day', () => {
    const source = summaries('balanced', 30);
    const result = calculate(source);
    expect(result.hrv).toMatchObject({
      historyStartDate: '2026-09-02',
      historyEndDate: '2026-09-29',
      lookbackDays: 28,
      lastIncludedDate: '2026-09-29',
    });
    expect(result.hrv.validSampleCount).toBeLessThanOrEqual(28);
  });

  test('does not let a changed current value alter its own baseline', () => {
    const source = summaries('balanced');
    const current = source.at(-1)!;
    const first = calculate(source).hrv;
    const changed = { ...current, hrv: current.hrv.status === 'available'
      ? { ...current.hrv, value: { ...current.hrv.value, averageRmssdMs: 999 } }
      : current.hrv };
    const second = calculateDailyBaselines(source, changed, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE).hrv;
    expect(second.center).toBe(first.center);
    expect(second.lowerBound).toBe(first.lowerBound);
    expect(second.currentValue).toBe(999);
  });

  test('ignores observations outside the rolling window', () => {
    const source = summaries('balanced', 30);
    const old = source.find((item) => item.date === '2026-09-01')!;
    const altered = { ...old, sleep: old.sleep.status === 'available'
      ? { ...old.sleep, value: { ...old.sleep.value, totalSleepMinutes: 1 } }
      : old.sleep };
    const original = calculate(source).sleepDuration;
    const result = calculate(source.map((item) => item.date === old.date ? altered : item)).sleepDuration;
    expect(result).toMatchObject({ center: original.center, lowerBound: original.lowerBound, upperBound: original.upperBound });
  });

  test('reports learning progress from valid observations, not elapsed calendar days', () => {
    const result = calculate(summaries('insufficient-history', 7));
    expect(result.sleepDuration).toMatchObject({ status: 'learning', validSampleCount: 6, requiredSampleCount: 14 });
    expect(result.hrv.status).toBe('learning');
    expect(result.restingHeartRate.status).toBe('learning');
  });

  test('distinguishes no valid history from a partially learned baseline', () => {
    const source = summaries('balanced');
    const current = source.at(-1)!;
    const noHistory = source.slice(0, -1).map((item) => ({ ...item, sleep: missingMetric<SleepDailySummary>('No sleep.', item.sleep.provenance) }));
    expect(calculateDailyBaselines(noHistory, current, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE).sleepDuration.status).toBe('insufficient-data');
  });

  test('excludes missing, unsupported, and query-failed history instead of treating it as zero', () => {
    const source = summaries('balanced');
    const current = source.at(-1)!;
    const history = source.slice(0, -1).map((item, index) => {
      if (index === 0) return { ...item, hrv: missingMetric<HrvDailySummary>('Missing.', item.hrv.provenance) };
      if (index === 1) return { ...item, hrv: unsupportedMetric<HrvDailySummary>('Unsupported.', item.hrv.provenance) };
      if (index === 2) return { ...item, hrv: failedMetric<HrvDailySummary>('Failed.', item.hrv.provenance) };
      return item;
    });
    const result = calculateDailyBaselines(history, current, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE).hrv;
    const expected = source.slice(0, -1).filter((item) => item.date >= addLocalDays(MOCK_ANCHOR_DATE, -28) && item.hrv.status === 'available').length - 3;
    expect(result.validSampleCount).toBe(expected);
    expect(result.lowerBound).toBeGreaterThan(0);
  });

  test('marks a provider-unsupported current metric unavailable', () => {
    const source = summaries('balanced');
    const current = source.at(-1)!;
    const altered = { ...current, hrv: unsupportedMetric<HrvDailySummary>('Unsupported.', current.hrv.provenance) };
    expect(calculateDailyBaselines(source, altered, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE).hrv.status).toBe('unavailable');
  });

  test('keeps a ready historical baseline when the current query fails', () => {
    const source = summaries('balanced');
    const current = source.at(-1)!;
    const altered = { ...current, heartRate: failedMetric<HeartRateDailySummary>('Failed.', current.heartRate.provenance) };
    const result = calculateDailyBaselines(source, altered, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE).restingHeartRate;
    expect(result).toMatchObject({ status: 'ready', currentStatus: 'query-failed' });
    expect(result.relation).toBeUndefined();
  });

  test('uses robust median and percentile bounds that resist one extreme outlier', () => {
    const source = summaries('balanced');
    const original = calculate(source).hrv;
    const target = source.find((item) => item.date === '2026-09-10')!;
    const altered = { ...target, hrv: target.hrv.status === 'available'
      ? { ...target.hrv, value: { ...target.hrv.value, averageRmssdMs: 10_000 } }
      : target.hrv };
    const result = calculate(source.map((item) => item.date === target.date ? altered : item)).hrv;
    expect(Math.abs(result.center! - original.center!)).toBeLessThanOrEqual(1);
    expect(result.upperBound).toBeLessThan(100);
  });

  test('calculates deterministic values, differences, percentages, and relations for all metrics', () => {
    const first = calculate(summaries('low-hrv-elevated-rhr'));
    const second = calculate(summaries('low-hrv-elevated-rhr'));
    expect(second).toEqual(first);
    for (const result of [first.hrv, first.restingHeartRate, first.sleepDuration]) {
      expect(result.status).toBe('ready');
      expect(result.center).toBeDefined();
      expect(result.lowerBound).toBeDefined();
      expect(result.upperBound).toBeDefined();
      expect(result.absoluteDifference).toBeDefined();
      expect(result.relativeDifferencePercent).toBeDefined();
      expect(result.relation).toBeDefined();
    }
  });

  test('recognizes expected mock scenario directions without producing a score', () => {
    expect(calculate(summaries('poor-sleep')).sleepDuration.relation).toBe('below-range');
    const strained = calculate(summaries('low-hrv-elevated-rhr'));
    expect(strained.hrv.relation).toBe('below-range');
    expect(strained.restingHeartRate.relation).toBe('above-range');
  });

  test('guards percentage math when a baseline center is zero', () => {
    const source = summaries('balanced');
    const current = source.at(-1)!;
    const zeroHistory = source.slice(0, -1).map((item) => ({ ...item, hrv: item.hrv.status === 'available'
      ? { ...item.hrv, value: { ...item.hrv.value, averageRmssdMs: 0 } }
      : item.hrv }));
    const result = calculateDailyBaselines(zeroHistory, current, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE).hrv;
    expect(result.center).toBe(0);
    expect(result.relativeDifferencePercent).toBeUndefined();
  });

  test('rejects a current summary from a different local day or zone', () => {
    const source = summaries('balanced');
    expect(() => calculateDailyBaselines(source, { ...source.at(-1)!, timeZone: 'UTC' }, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE)).toThrow(/local date and time zone/);
  });

  test('publishes the versioned threshold configuration', () => {
    expect(BASELINE_METHOD).toEqual({ version: 1, lookbackDays: 28, requiredSampleCount: 14, lowerPercentile: 20, upperPercentile: 80 });
  });
});
