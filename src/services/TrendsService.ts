import type { HealthMetricSource, LocalDate } from '../models/health';
import type { TrendRangeId, TrendReport } from '../models/trends';
import type { PersistedHealthRepository } from '../repositories/SQLiteHealthRepository';
import { addLocalDays } from '../shared/dates/healthDates';
import { buildTrendReport, TREND_CONFIG } from './trendEngine';

export class TrendsService {
  constructor(private readonly provider: HealthMetricSource, private readonly repository: PersistedHealthRepository) {}

  async getReport(range: TrendRangeId, endDate: LocalDate, timeZone: string): Promise<TrendReport> {
    const days = TREND_CONFIG.ranges[range];
    const queryStart = addLocalDays(endDate, -(days * 2 + 27));
    const history = await this.repository.getDailySummaries(this.provider, { start: queryStart, end: endDate, timeZone });
    return buildTrendReport(range, endDate, timeZone, history);
  }
}
