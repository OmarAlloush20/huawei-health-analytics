import type { DailyBaselineSet } from '../models/baseline';
import type { DailyHealthSummary, HealthMetricSource, LocalDate } from '../models/health';
import type { PersistedHealthRepository } from '../repositories/SQLiteHealthRepository';
import { addLocalDays } from '../shared/dates/healthDates';
import { BASELINE_METHOD, calculateDailyBaselines } from './baselineEngine';

export interface BaselineDayData {
  summary: DailyHealthSummary | null;
  baselines: DailyBaselineSet | null;
}

export class BaselineService {
  constructor(
    private readonly provider: HealthMetricSource,
    private readonly repository: PersistedHealthRepository,
  ) {}

  async readDay(date: LocalDate, timeZone: string): Promise<BaselineDayData> {
    const summary = await this.repository.getDailySummary(this.provider, { date, timeZone });
    if (!summary) return { summary: null, baselines: null };
    const history = await this.repository.getDailySummaries(this.provider, {
      start: addLocalDays(date, -BASELINE_METHOD.lookbackDays),
      end: addLocalDays(date, -1),
      timeZone,
    });
    return { summary, baselines: calculateDailyBaselines(history, summary, date, timeZone) };
  }
}
