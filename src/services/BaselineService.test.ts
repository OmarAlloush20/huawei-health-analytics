import type { PersistedHealthRepository } from '../repositories/SQLiteHealthRepository';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../providers/mock/mockHealthData';
import { BaselineService } from './BaselineService';

describe('BaselineService', () => {
  test('requests persisted history through yesterday in the evaluated time zone', async () => {
    const data = createMockHealthData('balanced', { start: '2026-09-02', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
    if (data.dailySummaries.status !== 'available') throw new Error('Expected summaries');
    const summary = data.dailySummaries.value.at(-1)!;
    const getDailySummaries = jest.fn().mockResolvedValue(data.dailySummaries.value);
    const repository = {
      getDailySummary: jest.fn().mockResolvedValue(summary),
      getDailySummaries,
    } as unknown as PersistedHealthRepository;

    const result = await new BaselineService('mock', repository).readDay(MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);

    expect(getDailySummaries).toHaveBeenCalledWith('mock', {
      start: '2026-09-02',
      end: '2026-09-29',
      timeZone: MOCK_TIME_ZONE,
    });
    expect(result.baselines?.hrv.status).toBe('ready');
  });

  test('does not query history when the selected persisted day does not exist', async () => {
    const getDailySummaries = jest.fn();
    const repository = {
      getDailySummary: jest.fn().mockResolvedValue(null),
      getDailySummaries,
    } as unknown as PersistedHealthRepository;
    await expect(new BaselineService('mock', repository).readDay(MOCK_ANCHOR_DATE, MOCK_TIME_ZONE))
      .resolves.toEqual({ summary: null, baselines: null });
    expect(getDailySummaries).not.toHaveBeenCalled();
  });
});
