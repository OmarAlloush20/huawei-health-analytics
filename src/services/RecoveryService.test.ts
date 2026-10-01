import type { BaselineDayData, BaselineService } from './BaselineService';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../providers/mock/mockHealthData';
import { calculateDailyBaselines } from './baselineEngine';
import { RecoveryService } from './RecoveryService';

describe('RecoveryService', () => {
  test('orchestrates baseline output into a Recovery result without provider logic', async () => {
    const data = createMockHealthData('balanced', { start: '2026-09-02', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
    if (data.dailySummaries.status !== 'available') throw new Error('Expected summaries');
    const summary = data.dailySummaries.value.at(-1)!;
    const day: BaselineDayData = {
      summary,
      baselines: calculateDailyBaselines(data.dailySummaries.value, summary, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE),
    };
    const baselineService = { readDay: jest.fn().mockResolvedValue(day) } as unknown as BaselineService;
    const result = await new RecoveryService(baselineService).readDay(MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
    expect(baselineService.readDay).toHaveBeenCalledWith(MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
    expect(result.recovery?.score).toBeDefined();
    expect(result.summary).toBe(summary);
  });

  test('preserves an absent persisted day without inventing Recovery', async () => {
    const baselineService = { readDay: jest.fn().mockResolvedValue({ summary: null, baselines: null }) } as unknown as BaselineService;
    await expect(new RecoveryService(baselineService).readDay(MOCK_ANCHOR_DATE, MOCK_TIME_ZONE))
      .resolves.toEqual({ summary: null, baselines: null, recovery: null });
  });
});
