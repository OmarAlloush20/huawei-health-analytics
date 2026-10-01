import { MockHealthProvider } from './MockHealthProvider';
import { createMockHealthData, getMockScenarioRange, MOCK_ANCHOR_DATE, MOCK_HEALTH_SCENARIOS, MOCK_TIME_ZONE } from './mockHealthData';
import { toLocalDate } from '../../shared/dates/healthDates';

const day = (date = MOCK_ANCHOR_DATE) => ({ start: date, end: date, timeZone: MOCK_TIME_ZONE });

describe('mock health data', () => {
  test('is deterministic and exposes every required scenario', () => {
    expect(MOCK_HEALTH_SCENARIOS.map((item) => item.id)).toEqual([
      'balanced',
      'poor-sleep',
      'low-hrv-elevated-rhr',
      'high-activity',
      'insufficient-history',
      'missing-data',
    ]);
    expect(createMockHealthData('balanced', day())).toEqual(createMockHealthData('balanced', day()));
  });

  test('provides 90 inclusive days normally and seven for insufficient history', () => {
    const balanced = createMockHealthData('balanced', getMockScenarioRange('balanced'));
    const insufficient = createMockHealthData('insufficient-history', getMockScenarioRange('insufficient-history'));
    expect(balanced.dailySummaries.status).toBe('available');
    expect(insufficient.dailySummaries.status).toBe('available');
    if (balanced.dailySummaries.status !== 'available' || insufficient.dailySummaries.status !== 'available') return;
    expect(balanced.dailySummaries.value).toHaveLength(90);
    expect(insufficient.dailySummaries.value).toHaveLength(7);
  });

  test('keeps generated values in documented units and realistic ranges', () => {
    const data = createMockHealthData('balanced', getMockScenarioRange('balanced'));
    if (data.dailySummaries.status !== 'available') throw new Error('Expected mock summaries');
    for (const summary of data.dailySummaries.value) {
      if (summary.activity.status === 'available') {
        expect(summary.activity.value.steps).toBeGreaterThanOrEqual(4_000);
        expect(summary.activity.value.steps).toBeLessThanOrEqual(12_000);
        expect(summary.activity.value.distanceMeters).toBeGreaterThan(2_500);
      }
      if (summary.sleep.status === 'available') {
        expect(summary.sleep.value.totalSleepMinutes).toBeGreaterThanOrEqual(360);
        expect(summary.sleep.value.totalSleepMinutes).toBeLessThanOrEqual(520);
      }
      if (summary.heartRate.status === 'available') expect(summary.heartRate.value.restingBpm).toBeGreaterThanOrEqual(50);
      if (summary.hrv.status === 'available') expect(summary.hrv.value.averageRmssdMs).toBeGreaterThanOrEqual(25);
      if (summary.oxygenSaturation.status === 'available') {
        expect(summary.oxygenSaturation.value.averagePercent).toBeGreaterThanOrEqual(95);
        expect(summary.oxygenSaturation.value.averagePercent).toBeLessThanOrEqual(100);
      }
      if (summary.stress.status === 'available') {
        expect(summary.stress.value.averageIndex).toBeGreaterThanOrEqual(0);
        expect(summary.stress.value.averageIndex).toBeLessThanOrEqual(100);
        expect(summary.stress.value.minimumIndex).toBeLessThanOrEqual(summary.stress.value.averageIndex);
        expect(summary.stress.value.maximumIndex).toBeGreaterThanOrEqual(summary.stress.value.averageIndex);
      }
      expect(summary.activityLoad.status).toBe('unsupported');
      expect(summary.activity.provenance.provider).toBe('mock');
    }
  });

  test('produces meaningfully different recent scenario behavior', () => {
    const balanced = createMockHealthData('balanced', day());
    const poorSleep = createMockHealthData('poor-sleep', day());
    const strained = createMockHealthData('low-hrv-elevated-rhr', day());
    const highActivity = createMockHealthData('high-activity', day());
    const pick = (data: typeof balanced) => {
      if (data.dailySummaries.status !== 'available') throw new Error('Expected summary');
      return data.dailySummaries.value[0];
    };
    const normal = pick(balanced);
    const tired = pick(poorSleep);
    const stressed = pick(strained);
    const active = pick(highActivity);
    if (normal.sleep.status !== 'available' || tired.sleep.status !== 'available') throw new Error('Expected sleep');
    if (normal.hrv.status !== 'available' || stressed.hrv.status !== 'available') throw new Error('Expected HRV');
    if (normal.heartRate.status !== 'available' || stressed.heartRate.status !== 'available') throw new Error('Expected heart rate');
    if (normal.activity.status !== 'available' || active.activity.status !== 'available') throw new Error('Expected activity');
    if (normal.stress.status !== 'available' || stressed.stress.status !== 'available') throw new Error('Expected stress');
    expect(tired.sleep.value.totalSleepMinutes).toBeLessThan(normal.sleep.value.totalSleepMinutes - 90);
    expect(stressed.hrv.value.averageRmssdMs).toBeLessThan(normal.hrv.value.averageRmssdMs - 15);
    expect(stressed.heartRate.value.restingBpm).toBeGreaterThan((normal.heartRate.value.restingBpm ?? 0) + 7);
    expect(active.activity.value.steps).toBeGreaterThan(normal.activity.value.steps + 5_000);
    expect(stressed.stress.value.averageIndex).toBeGreaterThan(normal.stress.value.averageIndex + 15);
  });

  test('represents missing, failed, and unsupported data without zero substitution', () => {
    const data = createMockHealthData('missing-data', { start: '2026-09-24', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
    if (data.dailySummaries.status !== 'available') throw new Error('Expected summaries');
    expect(data.dailySummaries.value.some((item) => item.sleep.status === 'missing')).toBe(true);
    expect(data.dailySummaries.value.some((item) => item.heartRate.status === 'query-failed')).toBe(true);
    expect(data.dailySummaries.value.some((item) => item.stress.status === 'missing')).toBe(true);
    expect(data.dailySummaries.value.every((item) => item.activityLoad.status === 'unsupported')).toBe(true);
    const failed = data.dailySummaries.value.find((item) => item.heartRate.status === 'query-failed');
    expect(failed?.completeness.queryFailed).toContain('heartRate');
  });

  test('sleep stage and detailed collection aggregation is coherent', () => {
    const data = createMockHealthData('balanced', day());
    if (data.sleepSessions.status !== 'available') throw new Error('Expected sleep sessions');
    if (data.heartRateSamples.status !== 'available') throw new Error('Expected heart samples');
    const session = data.sleepSessions.value[0];
    expect(session.stages.reduce((sum, stage) => sum + stage.durationMinutes, 0)).toBe(session.timeInBedMinutes);
    expect(session.stages.filter((stage) => stage.stage !== 'awake').reduce((sum, stage) => sum + stage.durationMinutes, 0)).toBe(session.durationMinutes);
    expect(toLocalDate(new Date(session.endTime), MOCK_TIME_ZONE)).toBe(MOCK_ANCHOR_DATE);
    expect(data.heartRateSamples.value).toHaveLength(4);
    expect(data.hrvObservations.status === 'available' ? data.hrvObservations.value.length : 0).toBe(1);
    expect(data.oxygenSaturationSamples.status === 'available' ? data.oxygenSaturationSamples.value.length : 0).toBe(3);
  });

  test('provider scenario selection and range filtering work through the contract', async () => {
    const provider = new MockHealthProvider({ scenario: 'insufficient-history' });
    expect(provider.getAvailableRange()).toEqual(getMockScenarioRange('insufficient-history'));
    expect(await provider.getDailySummaries(provider.getAvailableRange())).toHaveLength(7);
    provider.setScenario('balanced');
    const result = await provider.getDailySummary({ date: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
    expect(result?.source).toBe('mock');
    expect((await provider.requestAuthorization(['sleep:read'])).granted).toEqual(['sleep:read']);
  });
});
