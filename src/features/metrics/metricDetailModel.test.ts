import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../../providers/mock/mockHealthData';
import { buildRawMetricPoints, summarizeMetricPoints } from './metricDetailModel';

describe('metric detail model', () => {
  test.each([7, 30, 90])('builds an exact %i-day Stress history without inventing gaps', (days) => {
    const data = createMockHealthData('missing-data', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
    if (data.dailySummaries.status !== 'available') throw new Error('Expected mock summaries');
    const points = buildRawMetricPoints('stress', data.dailySummaries.value, MOCK_ANCHOR_DATE, days, MOCK_TIME_ZONE);
    expect(points).toHaveLength(days);
    expect(points.some((point) => point.status !== 'available')).toBe(true);
  });

  test('reports the latest recorded point, average, and honest coverage', () => {
    const summary = summarizeMetricPoints([
      { date: '2026-09-28', status: 'available', value: 10 },
      { date: '2026-09-29', status: 'missing' },
      { date: '2026-09-30', status: 'available', value: 20 },
    ]);
    expect(summary).toMatchObject({ latest: { date: '2026-09-30', value: 20 }, average: 15, availableDays: 2, expectedDays: 3 });
  });
});
