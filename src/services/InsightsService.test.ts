import type { TrendsService } from './TrendsService';
import { InsightsService } from './InsightsService';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../providers/mock/mockHealthData';
import { buildTrendReport } from './trendEngine';

describe('InsightsService', () => {
  test('delegates the persisted report request and returns deterministic insight output', async () => {
    const data = createMockHealthData('high-activity', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
    if (data.dailySummaries.status !== 'available') throw new Error('Expected history');
    const report = buildTrendReport('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, data.dailySummaries.value);
    const trendsService = { getReport: jest.fn().mockResolvedValue(report) } as unknown as TrendsService;
    const engine = new InsightsService(trendsService);
    const result = await engine.getInsights('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
    expect(result.insights.some((item) => item.metric === 'steps')).toBe(true);
    expect(trendsService.getReport).toHaveBeenCalledWith('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
  });
});
