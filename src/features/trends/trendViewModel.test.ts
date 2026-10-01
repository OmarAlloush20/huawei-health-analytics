import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../../providers/mock/mockHealthData';
import { buildTrendReport } from '../../services/trendEngine';
import { buildTrendsViewModel } from './trendViewModel';

describe('Trends view model', () => {
  test('formats five metric cards, comparisons, and coverage without removing gaps', () => {
    const data = createMockHealthData('missing-data', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
    if (data.dailySummaries.status !== 'available') throw new Error('Expected history');
    const report = buildTrendReport('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, data.dailySummaries.value);
    const model = buildTrendsViewModel(report);
    expect(model.cards.map((card) => card.metric)).toEqual(['recovery', 'sleep-duration', 'hrv-rmssd', 'resting-heart-rate', 'steps']);
    expect(model.cards.every((card) => card.coverage.match(/\d+ of 7 days available/))).toBe(true);
    expect(model.cards.find((card) => card.metric === 'hrv-rmssd')?.points.some((point) => point.status !== 'available')).toBe(true);
  });

  test('uses calm insufficient-comparison copy for a 90-day range without previous history', () => {
    const data = createMockHealthData('balanced', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
    if (data.dailySummaries.status !== 'available') throw new Error('Expected history');
    const model = buildTrendsViewModel(buildTrendReport('90d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, data.dailySummaries.value));
    expect(model.cards).toHaveLength(5);
    expect(model.cards.every((card) => card.comparison.includes('Not enough coverage'))).toBe(true);
  });
});
