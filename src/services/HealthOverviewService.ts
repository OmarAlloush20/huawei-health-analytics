import type { DailyHealthSummary } from '../models/health';
import type { HealthSummaryRepository } from '../repositories/HealthSummaryRepository';
import { getSystemTimeZone, toLocalDate } from '../shared/dates/healthDates';

export class HealthOverviewService {
  constructor(private readonly repository: HealthSummaryRepository) {}

  getToday(now = new Date(), timeZone = getSystemTimeZone()): Promise<DailyHealthSummary | null> {
    return this.repository.getDailySummary({ date: toLocalDate(now, timeZone), timeZone });
  }
}
