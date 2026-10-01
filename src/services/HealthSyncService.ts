import type { DateRange, HealthMetricSource, NormalizedHealthData } from '../models/health';
import type { HealthDataProvider } from '../providers/HealthDataProvider';
import type { PersistedHealthRepository } from '../repositories/SQLiteHealthRepository';
import type { RetentionPolicy, StoredHealthStats } from '../database/types';
import { DEFAULT_RETENTION_POLICY } from '../database/types';

export class HealthSyncService {
  constructor(
    private readonly provider: HealthDataProvider,
    private readonly repository: PersistedHealthRepository,
    private readonly retentionPolicy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
  ) {}

  async sync(range: DateRange): Promise<NormalizedHealthData> {
    const attemptedAt = new Date().toISOString();
    await this.repository.recordSyncAttempt(this.provider.id, range, attemptedAt);
    try {
      const data = await this.provider.getHealthData(range);
      await this.repository.replaceProviderData(this.provider.id, data, attemptedAt);
      await this.repository.applyRetention(this.retentionPolicy, range.end);
      return this.repository.getHealthData(this.provider.id, range);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Health-data sync failed.';
      await this.repository.recordSyncFailure(this.provider.id, range, attemptedAt, message);
      throw cause;
    }
  }

  read(range: DateRange): Promise<NormalizedHealthData> {
    return this.repository.getHealthData(this.provider.id, range);
  }

  getStats(): Promise<StoredHealthStats> {
    return this.repository.getStats(this.provider.id);
  }

  deleteDetailedData(): Promise<number> {
    return this.repository.deleteDetailedHealthData(this.provider.id);
  }

  deleteAllLocalHealthData(): Promise<number> {
    return this.repository.deleteAllLocalHealthData();
  }

  get providerId(): HealthMetricSource {
    return this.provider.id;
  }
}
