import type { BaselineResult, DailyBaselineSet } from '../models/baseline';
import type { HealthMetric } from '../models/health';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_HEALTH_SCENARIOS, MOCK_TIME_ZONE } from '../providers/mock/mockHealthData';
import { calculateDailyBaselines } from './baselineEngine';
import { calculateRecovery, RECOVERY_ENGINE_CONFIG, recoveryCategory } from './recoveryEngine';

const baseResult = (metric: BaselineResult['metric'], currentValue: number, center: number, lowerBound: number, upperBound: number): BaselineResult => ({
  metric,
  status: 'ready',
  unit: metric === 'hrv-rmssd' ? 'ms' : metric === 'resting-heart-rate' ? 'bpm' : 'minutes',
  evaluatedDate: MOCK_ANCHOR_DATE,
  timeZone: MOCK_TIME_ZONE,
  historyStartDate: '2026-09-02',
  historyEndDate: '2026-09-29',
  lookbackDays: 28,
  requiredSampleCount: 14,
  validSampleCount: 28,
  currentStatus: 'available',
  currentValue,
  center,
  lowerBound,
  upperBound,
  absoluteDifference: currentValue - center,
  relativeDifferencePercent: ((currentValue - center) / center) * 100,
  relation: currentValue < lowerBound ? 'below-range' : currentValue > upperBound ? 'above-range' : 'within-range',
});

function baselineSet(overrides: Partial<DailyBaselineSet> = {}): DailyBaselineSet {
  return {
    evaluatedDate: MOCK_ANCHOR_DATE,
    timeZone: MOCK_TIME_ZONE,
    hrv: baseResult('hrv-rmssd', 50, 50, 40, 55),
    restingHeartRate: baseResult('resting-heart-rate', 60, 60, 56, 64),
    sleepDuration: baseResult('sleep-duration', 420, 420, 390, 450),
    ...overrides,
  };
}

function scenarioRecovery(scenario: Parameters<typeof createMockHealthData>[0]) {
  const data = createMockHealthData(scenario, { start: '2026-09-02', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  if (data.dailySummaries.status !== 'available') throw new Error('Expected summaries');
  const current = data.dailySummaries.value.at(-1)!;
  return calculateRecovery(calculateDailyBaselines(data.dailySummaries.value, current, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE));
}

function unavailableToday(result: BaselineResult, status: Exclude<HealthMetric<unknown>['status'], 'available'> = 'missing'): BaselineResult {
  return { ...result, currentStatus: status, currentValue: undefined, absoluteDifference: undefined, relativeDifferencePercent: undefined, relation: undefined };
}

describe('Recovery Engine V1', () => {
  test('publishes versioned weights that sum exactly to one', () => {
    expect(RECOVERY_ENGINE_CONFIG.version).toBe(1);
    expect(Object.values(RECOVERY_ENGINE_CONFIG.weights).reduce((sum, value) => sum + value, 0)).toBe(1);
    expect(RECOVERY_ENGINE_CONFIG.weights).toEqual({ 'hrv-rmssd': 0.4, 'resting-heart-rate': 0.35, 'sleep-duration': 0.25 });
  });

  test('scores all within-range signals neutrally with complete inputs', () => {
    const result = calculateRecovery(baselineSet());
    expect(result).toMatchObject({ status: 'ready', completeness: 'complete', completenessPercent: 100, score: 75, category: 'good' });
    expect(result.contributions.map((item) => item.signalScore)).toEqual([75, 75, 75]);
    expect(result.contributions.reduce((sum, item) => sum + (item.weightedPoints ?? 0), 0)).toBe(result.score);
  });

  test('applies the exact HRV weight and a gradual below-range penalty', () => {
    const result = calculateRecovery(baselineSet({ hrv: baseResult('hrv-rmssd', 30, 50, 40, 55) }));
    expect(result.score).toBe(55);
    expect(result.contributions[0]).toMatchObject({ signalScore: 25, normalizedWeight: 0.4, weightedPoints: 10, impactFromNeutral: -20 });
  });

  test('penalizes elevated resting heart rate and short sleep in their correct directions', () => {
    const highRhr = calculateRecovery(baselineSet({ restingHeartRate: baseResult('resting-heart-rate', 68, 60, 56, 64) }));
    const shortSleep = calculateRecovery(baselineSet({ sleepDuration: baseResult('sleep-duration', 360, 420, 390, 450) }));
    expect(highRhr.contributions[1].signalScore).toBe(25);
    expect(shortSleep.contributions[2].signalScore).toBe(25);
    expect(highRhr.score).toBeLessThan(75);
    expect(shortSleep.score).toBeLessThan(75);
  });

  test('allows only a capped favorable deviation', () => {
    const favorable = calculateRecovery(baselineSet({ hrv: baseResult('hrv-rmssd', 500, 50, 40, 55) }));
    expect(favorable.contributions[0].signalScore).toBe(90);
    expect(favorable.score).toBe(81);
    expect(favorable.score).toBeLessThanOrEqual(100);
  });

  test('caps extreme adverse outliers and always bounds the final score', () => {
    const result = calculateRecovery(baselineSet({
      hrv: baseResult('hrv-rmssd', 0.1, 50, 40, 55),
      restingHeartRate: baseResult('resting-heart-rate', 500, 60, 56, 64),
      sleepDuration: baseResult('sleep-duration', 0, 420, 390, 450),
    }));
    expect(result.contributions.map((item) => item.signalScore)).toEqual([0, 0, 0]);
    expect(result.score).toBe(0);
    expect(result.category).toBe('low');
  });

  test('renormalizes two available signal weights and reduces completeness', () => {
    const source = baselineSet();
    const result = calculateRecovery({ ...source, sleepDuration: unavailableToday(source.sleepDuration) });
    expect(result).toMatchObject({ status: 'partial', completeness: 'partial', completenessPercent: 75, usableSignalCount: 2, score: 75 });
    expect(result.contributions[0].normalizedWeight).toBe(0.5333);
    expect(result.contributions[1].normalizedWeight).toBe(0.4667);
    expect(result.contributions[2].status).toBe('today-unavailable');
    expect(result.contributions[2].weightedPoints).toBeUndefined();
  });

  test('does not produce a score with fewer than two usable signals', () => {
    const source = baselineSet();
    const result = calculateRecovery({
      ...source,
      restingHeartRate: unavailableToday(source.restingHeartRate, 'query-failed'),
      sleepDuration: unavailableToday(source.sleepDuration, 'unsupported'),
    });
    expect(result).toMatchObject({ status: 'unavailable', completeness: 'insufficient', usableSignalCount: 1 });
    expect(result.score).toBeUndefined();
    expect(result.category).toBeUndefined();
  });

  test('returns learning rather than a synthetic score before enough baselines are ready', () => {
    const source = baselineSet();
    const learning = (result: BaselineResult): BaselineResult => ({ ...result, status: 'learning', validSampleCount: 7, center: undefined, lowerBound: undefined, upperBound: undefined });
    const result = calculateRecovery({ ...source, hrv: learning(source.hrv), restingHeartRate: learning(source.restingHeartRate) });
    expect(result).toMatchObject({ status: 'learning', completeness: 'insufficient', usableSignalCount: 1 });
    expect(result.score).toBeUndefined();
  });

  test.each([
    ['NaN current', { hrv: { ...baselineSet().hrv, currentValue: Number.NaN } }],
    ['infinite center', { restingHeartRate: { ...baselineSet().restingHeartRate, center: Number.POSITIVE_INFINITY } }],
    ['negative HRV', { hrv: { ...baselineSet().hrv, currentValue: -1 } }],
    ['negative sleep', { sleepDuration: { ...baselineSet().sleepDuration, currentValue: -1 } }],
    ['reversed bounds', { hrv: { ...baselineSet().hrv, lowerBound: 60, upperBound: 40 } }],
  ] as const)('excludes invalid numeric input: %s', (_label, overrides) => {
    const result = calculateRecovery(baselineSet(overrides as Partial<DailyBaselineSet>));
    expect(result.contributions.some((item) => item.status === 'invalid')).toBe(true);
    expect(result.score === undefined || Number.isFinite(result.score)).toBe(true);
  });

  test('classifies category boundaries deterministically', () => {
    expect([recoveryCategory(0), recoveryCategory(39), recoveryCategory(40), recoveryCategory(59), recoveryCategory(60), recoveryCategory(79), recoveryCategory(80), recoveryCategory(100)])
      .toEqual(['low', 'low', 'fair', 'fair', 'good', 'good', 'high', 'high']);
  });

  test('generates deterministic explanations from the strongest adverse contributions', () => {
    const inputs = baselineSet({
      hrv: baseResult('hrv-rmssd', 30, 50, 40, 55),
      restingHeartRate: baseResult('resting-heart-rate', 68, 60, 56, 64),
    });
    const first = calculateRecovery(inputs);
    const second = calculateRecovery(inputs);
    expect(second).toEqual(first);
    expect(first.explanation).toBe('HRV was below your recent range. Resting heart rate was above your recent range.');
  });

  test('keeps exact current and baseline values in structured contributions', () => {
    const result = calculateRecovery(baselineSet()).contributions[0];
    expect(result).toMatchObject({ currentValue: 50, baselineCenter: 50, lowerBound: 40, upperBound: 55, configuredWeight: 0.4 });
  });

  test('mock scenarios produce conceptual, not overfit, regressions', () => {
    const balanced = scenarioRecovery('balanced');
    const poorSleep = scenarioRecovery('poor-sleep');
    const strained = scenarioRecovery('low-hrv-elevated-rhr');
    const highActivity = scenarioRecovery('high-activity');
    const insufficient = scenarioRecovery('insufficient-history');
    const missing = scenarioRecovery('missing-data');
    expect(balanced.score).toBeDefined();
    expect(poorSleep.score!).toBeLessThan(balanced.score!);
    expect(strained.score!).toBeLessThan(balanced.score!);
    expect(highActivity.score).toBe(balanced.score);
    expect(insufficient.status).toBe('learning');
    expect(insufficient.score).toBeUndefined();
    expect(missing).toMatchObject({ status: 'partial', completeness: 'partial', usableSignalCount: 2 });
  });

  test.each(MOCK_HEALTH_SCENARIOS.map(({ id }) => [id] as const))('returns a stable result for the %s scenario', (scenario) => {
    expect(scenarioRecovery(scenario)).toEqual(scenarioRecovery(scenario));
  });
});
