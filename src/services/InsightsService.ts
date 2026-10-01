import type { LocalDate } from '../models/health';
import type { InsightsResult } from '../models/insights';
import type { TrendRangeId } from '../models/trends';
import type { TrendsService } from './TrendsService';
import { generateInsights } from './insightsEngine';

export class InsightsService {
  constructor(private readonly trendsService: TrendsService) {}

  async getInsights(range: TrendRangeId, endDate: LocalDate, timeZone: string): Promise<InsightsResult> {
    return generateInsights(await this.trendsService.getReport(range, endDate, timeZone));
  }
}
