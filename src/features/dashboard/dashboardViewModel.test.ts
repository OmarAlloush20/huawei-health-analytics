import type { HealthSyncMetadata } from '../../database/types';
import type { DailyHealthSummary, HrvDailySummary } from '../../models/health';
import { unsupportedMetric } from '../../models/healthMetrics';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_HEALTH_SCENARIOS, MOCK_TIME_ZONE } from '../../providers/mock/mockHealthData';
import {
  buildDashboardViewModel,
  formatDashboardDate,
  formatSyncFreshness,
  getEmptyDashboardMessage,
  moveDashboardDate,
} from './dashboardViewModel';
import { calculateDailyBaselines } from '../../services/baselineEngine';
import { calculateRecovery } from '../../services/recoveryEngine';
import type { DeterministicInsight } from '../../models/insights';

function summary(scenario: Parameters<typeof createMockHealthData>[0], date = MOCK_ANCHOR_DATE): DailyHealthSummary {
  const result = createMockHealthData(scenario, { start: date, end: date, timeZone: MOCK_TIME_ZONE });
  if (result.dailySummaries.status !== 'available' || !result.dailySummaries.value[0]) throw new Error('Expected a mock summary');
  return result.dailySummaries.value[0];
}

function baseline(scenario: Parameters<typeof createMockHealthData>[0]) {
  const result = createMockHealthData(scenario, { start: '2026-09-02', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  if (result.dailySummaries.status !== 'available') throw new Error('Expected summaries');
  return calculateDailyBaselines(result.dailySummaries.value, result.dailySummaries.value.at(-1)!, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
}

describe('Dashboard view model', () => {
  test('formats complete daily health data without adding interpretation', () => {
    const model = buildDashboardViewModel(summary('balanced'), MOCK_ANCHOR_DATE);
    expect(model.dateLabel).toBe('Today');
    expect(model.sleep.value).toMatch(/^\d+h \d+m$/);
    expect(model.sleep.stages).toContain('Deep');
    expect(model.hrv).toMatchObject({ status: 'available', unit: 'ms RMSSD' });
    expect(model.restingHeartRate).toMatchObject({ status: 'available', unit: 'bpm' });
    expect(model.oxygenSaturation).toMatchObject({ status: 'available', unit: '%' });
    expect(model.stress).toMatchObject({ status: 'available', unit: '/ 100' });
    expect(model.activity.facts).toHaveLength(3);
  });

  test('shows missing values as No data instead of zero', () => {
    const model = buildDashboardViewModel(summary('missing-data', '2026-09-28'), MOCK_ANCHOR_DATE);
    expect(model.sleep).toMatchObject({ status: 'missing', value: 'No data' });
    expect(model.hrv).toMatchObject({ status: 'missing', value: 'No data' });
    expect(model.oxygenSaturation).toMatchObject({ status: 'missing', value: 'No data' });
    expect(model.stress).toMatchObject({ status: 'missing', value: 'No data' });
  });

  test('labels unsupported metrics honestly', () => {
    const source = summary('balanced');
    const unsupported = {
      ...source,
      hrv: unsupportedMetric<HrvDailySummary>('Unavailable from this source.', source.hrv.provenance),
    };
    expect(buildDashboardViewModel(unsupported, MOCK_ANCHOR_DATE).hrv).toEqual({
      status: 'unsupported',
      value: 'Not supported by this data source',
    });
  });

  test('labels a query failure without presenting a measurement', () => {
    const model = buildDashboardViewModel(summary('missing-data', '2026-09-29'), MOCK_ANCHOR_DATE);
    expect(model.restingHeartRate).toEqual({ status: 'query-failed', value: 'Unable to load' });
  });

  test('clamps date navigation to the persisted range', () => {
    expect(moveDashboardDate('2026-09-15', -1, '2026-09-14', '2026-09-16')).toBe('2026-09-14');
    expect(moveDashboardDate('2026-09-14', -1, '2026-09-14', '2026-09-16')).toBe('2026-09-14');
    expect(moveDashboardDate('2026-09-16', 1, '2026-09-14', '2026-09-16')).toBe('2026-09-16');
    expect(formatDashboardDate('2026-09-29', MOCK_ANCHOR_DATE)).toBe('Yesterday');
  });

  test('formats sync freshness and failure states', () => {
    const now = new Date('2026-09-30T12:10:00.000Z');
    const sync: HealthSyncMetadata = {
      provider: 'mock',
      status: 'succeeded',
      lastAttemptedAt: '2026-09-30T12:05:00.000Z',
      lastSuccessfulAt: '2026-09-30T12:05:00.000Z',
    };
    expect(formatSyncFreshness(sync, now)).toBe('Updated 5 min ago');
    expect(formatSyncFreshness({ ...sync, status: 'failed' }, now)).toBe('Last refresh failed');
    expect(formatSyncFreshness(null, now)).toBe('Not synced yet');
  });

  test('distinguishes an empty database from an earlier-data state', () => {
    expect(getEmptyDashboardMessage(0)).toContain('first successful sync');
    expect(getEmptyDashboardMessage(12)).toContain('earlier health data');
  });

  test('shows a real score, category, explanation, and formatted contribution details', () => {
    const baselines = baseline('low-hrv-elevated-rhr');
    const model = buildDashboardViewModel(summary('low-hrv-elevated-rhr'), MOCK_ANCHOR_DATE, baselines, calculateRecovery(baselines));
    expect(model.hrv.comparison).toMatch(/below your recent baseline/);
    expect(model.hrv.baselineDetail).toMatch(/Typical .* valid days/);
    expect(model.restingHeartRate.comparison).toMatch(/above your recent baseline/);
    expect(model.recovery).toMatchObject({ state: 'ready', title: expect.stringMatching(/^\d+ \/ 100$/), category: expect.stringMatching(/recovery$/), completeness: '100% inputs' });
    expect(model.recovery.detail).toContain('HRV was below');
    expect(model.recovery.details).toHaveLength(3);
    expect(model.recovery.details[0]).toMatchObject({ signal: 'HRV', current: expect.stringMatching(/ms$/), baseline: expect.stringMatching(/ms$/), contribution: expect.stringMatching(/pts vs neutral$/), weight: '40% applied weight' });
  });

  test('shows valid-day learning progress for insufficient history', () => {
    const baselines = baseline('insufficient-history');
    const model = buildDashboardViewModel(summary('insufficient-history'), MOCK_ANCHOR_DATE, baselines, calculateRecovery(baselines));
    expect(model.sleep.comparison).toBe('Learning baseline - 6 of 14 valid days');
    expect(model.recovery).toMatchObject({ state: 'learning', title: 'Learning your baseline' });
    expect(model.recovery.detail).toContain('5 of 14 valid days');
  });

  test('shows partial input completeness when one current signal is missing', () => {
    const baselines = baseline('missing-data');
    const model = buildDashboardViewModel(summary('missing-data'), MOCK_ANCHOR_DATE, baselines, calculateRecovery(baselines));
    expect(model.recovery).toMatchObject({ state: 'partial', completeness: '60% inputs' });
    expect(model.recovery.details.find((item) => item.signal === 'HRV')).toMatchObject({ status: 'today-unavailable', contribution: undefined });
  });

  test('preserves unavailable current metric copy while exposing baseline readiness separately', () => {
    const model = buildDashboardViewModel(summary('missing-data', '2026-09-29'), MOCK_ANCHOR_DATE);
    expect(model.restingHeartRate).toMatchObject({ status: 'query-failed', value: 'Unable to load' });
    expect(model.restingHeartRate.comparison).toBeUndefined();
  });

  test('presents a real Home insight or a calm neutral fallback', () => {
    const source = summary('balanced');
    expect(buildDashboardViewModel(source, MOCK_ANCHOR_DATE).insight).toMatchObject({ available: false, title: 'No notable change' });
    const insight: DeterministicInsight = {
      version: 1, ruleId: 'test-v1', type: 'period-comparison', metric: 'steps', importance: 'informational',
      title: 'Steps increased', explanation: 'Average steps were higher than the previous period.', range: '7d',
      startDate: '2026-09-24', endDate: MOCK_ANCHOR_DATE, priority: 70,
      evidence: { availableDays: 7, expectedDays: 7, unit: 'steps' },
    };
    expect(buildDashboardViewModel(source, MOCK_ANCHOR_DATE, undefined, undefined, insight).insight)
      .toEqual({ available: true, title: insight.title, detail: insight.explanation });
  });

  test.each(MOCK_HEALTH_SCENARIOS.map(({ id }) => [id] as const))('builds a complete Dashboard model for the %s scenario', (scenario) => {
    const baselines = baseline(scenario);
    const model = buildDashboardViewModel(summary(scenario), MOCK_ANCHOR_DATE, baselines, calculateRecovery(baselines));
    expect(model.date).toBe(MOCK_ANCHOR_DATE);
    expect(model.recovery.title).toBeTruthy();
    expect(model.sleep.value).toBeTruthy();
    expect(model.hrv.value).toBeTruthy();
    expect(model.restingHeartRate.value).toBeTruthy();
    expect(model.stress.value).toBeTruthy();
  });
});
