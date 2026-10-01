import type { DailyHealthSummary } from '../models/health';
import type { TrendReport } from '../models/trends';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_HEALTH_SCENARIOS, MOCK_TIME_ZONE } from '../providers/mock/mockHealthData';
import { buildTrendReport } from './trendEngine';
import { generateInsights, INSIGHTS_CONFIG } from './insightsEngine';

function report(scenario: Parameters<typeof createMockHealthData>[0]): TrendReport {
  const data = createMockHealthData(scenario, { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  if (data.dailySummaries.status !== 'available') throw new Error('Expected history');
  return buildTrendReport('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, data.dailySummaries.value as DailyHealthSummary[]);
}

describe('deterministic insights engine', () => {
  test('generates supported scenario insights from evidence', () => {
    const poorSleep = generateInsights(report('poor-sleep')).insights;
    const strained = generateInsights(report('low-hrv-elevated-rhr')).insights;
    const highActivity = generateInsights(report('high-activity')).insights;
    expect(poorSleep.some((item) => item.metric === 'sleep-duration')).toBe(true);
    expect(strained.some((item) => item.metric === 'hrv-rmssd')).toBe(true);
    expect(strained.some((item) => item.metric === 'resting-heart-rate')).toBe(true);
    expect(highActivity.some((item) => item.metric === 'steps')).toBe(true);
  });

  test('detects persistent deviations only across consecutive recorded days', () => {
    const source = report('low-hrv-elevated-rhr');
    expect(generateInsights(source).insights.some((item) => item.type === 'persistent-deviation')).toBe(true);
    const broken: TrendReport = {
      ...source,
      series: { ...source.series, 'hrv-rmssd': { ...source.series['hrv-rmssd'], points: source.series['hrv-rmssd'].points.map((point, index, all) => index === all.length - 2 ? { ...point, status: 'missing', relation: undefined } : point) } },
    };
    expect(generateInsights(broken).insights.some((item) => item.ruleId === 'persistent-hrv-rmssd-v1')).toBe(false);
  });

  test('does not turn a stable comparison into a headline', () => {
    const source = report('balanced');
    const stable: TrendReport = {
      ...source,
      series: { ...source.series, steps: { ...source.series.steps, comparison: { direction: 'stable', material: false, currentValue: 7_001, previousValue: 7_000, absoluteChange: 1, relativeChangePercent: 0 } } },
    };
    expect(generateInsights(stable).insights.some((item) => item.ruleId === 'period-steps-v1')).toBe(false);
  });

  test('prioritizes persistent evidence deterministically and limits output', () => {
    const first = generateInsights(report('low-hrv-elevated-rhr'));
    const second = generateInsights(report('low-hrv-elevated-rhr'));
    expect(second).toEqual(first);
    expect(first.insights.length).toBeLessThanOrEqual(INSIGHTS_CONFIG.maximumVisibleInsights);
    expect(first.insights[0].priority).toBeGreaterThanOrEqual(first.insights.at(-1)!.priority);
    expect(first.insights.every((item) => item.ruleId && item.evidence.availableDays >= 0)).toBe(true);
  });

  test('insufficient history and missing data never fabricate continuity', () => {
    const insufficient = generateInsights(report('insufficient-history'));
    const missing = generateInsights(report('missing-data'));
    expect(insufficient.insights.every((item) => item.type !== 'persistent-deviation')).toBe(true);
    expect(missing.insights.every((item) => (item.evidence.consecutiveDays ?? 0) <= 3)).toBe(true);
  });

  test.each(MOCK_HEALTH_SCENARIOS.map(({ id }) => [id] as const))('builds a bounded curated result for the %s scenario', (scenario) => {
    const result = generateInsights(report(scenario));
    expect(result.insights.length).toBeLessThanOrEqual(3);
    expect(result.insights.every((item) => item.explanation.length > 0 && item.evidence.expectedDays === 7)).toBe(true);
  });
});
