import type { DailyHealthSummary, DateRange, HealthDayQuery } from '../models/health';
import type { HealthDataProvider } from '../providers/HealthDataProvider';

export interface HealthSummaryRepository {
  getDailySummary(query: HealthDayQuery): Promise<DailyHealthSummary | null>;
  getDailySummaries(range: DateRange): Promise<DailyHealthSummary[]>;
}

export class ProviderHealthSummaryRepository implements HealthSummaryRepository {
  constructor(private readonly provider: HealthDataProvider) {}

  getDailySummary(query: HealthDayQuery): Promise<DailyHealthSummary | null> {
    return this.provider.getDailySummary(query);
  }

  getDailySummaries(range: DateRange): Promise<DailyHealthSummary[]> {
    return this.provider.getDailySummaries(range);
  }
}
