import type { PersistedHealthRepository } from '../repositories/SQLiteHealthRepository';
import { MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../providers/mock/mockHealthData';
import { TrendsService } from './TrendsService';

describe('TrendsService', () => {
  test.each([
    ['7d', '2026-08-20'],
    ['30d', '2026-07-05'],
    ['90d', '2026-03-07'],
  ] as const)('loads %s current/previous periods and one baseline lead-in with one query', async (range, expectedStart) => {
    const getDailySummaries = jest.fn().mockResolvedValue([]);
    const repository = { getDailySummaries } as unknown as PersistedHealthRepository;
    await new TrendsService('mock', repository).getReport(range, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
    expect(getDailySummaries).toHaveBeenCalledTimes(1);
    expect(getDailySummaries).toHaveBeenCalledWith('mock', { start: expectedStart, end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  });
});
