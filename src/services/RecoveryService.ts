import type { RecoveryResult } from '../models/recovery';
import type { LocalDate } from '../models/health';
import type { BaselineDayData, BaselineService } from './BaselineService';
import { calculateRecovery } from './recoveryEngine';

export interface RecoveryDayData extends BaselineDayData {
  recovery: RecoveryResult | null;
}

export class RecoveryService {
  constructor(private readonly baselineService: BaselineService) {}

  async readDay(date: LocalDate, timeZone: string): Promise<RecoveryDayData> {
    const day = await this.baselineService.readDay(date, timeZone);
    return { ...day, recovery: day.baselines ? calculateRecovery(day.baselines) : null };
  }
}
