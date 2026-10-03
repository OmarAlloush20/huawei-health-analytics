import type { LocalDate } from '../models/health';
import { resetAndReseedDevelopmentDatabase } from '../database/developmentReset';
import type { HealthDatabase, StoredHealthStats } from '../database/types';
import type { HealthDataProvider } from '../providers/HealthDataProvider';
import { MockHealthProvider } from '../providers/mock/MockHealthProvider';
import { MOCK_HEALTH_SCENARIOS, type MockHealthScenarioId } from '../providers/mock/mockHealthData';
import type { PersistedHealthRepository } from '../repositories/SQLiteHealthRepository';
import type { HealthSyncService } from './HealthSyncService';
import type { RecoveryDayData, RecoveryService } from './RecoveryService';
import type { DeterministicInsight } from '../models/insights';
import type { InsightsService } from './InsightsService';

export interface DashboardDayData extends RecoveryDayData {
  insight: DeterministicInsight | null;
}

export type DevelopmentScenarioId = MockHealthScenarioId;

export interface DevelopmentScenarioState {
  current: DevelopmentScenarioId;
  options: readonly { id: DevelopmentScenarioId; label: string; description: string }[];
}

export class DashboardDataService {
  constructor(
    private readonly provider: HealthDataProvider,
    private readonly database: HealthDatabase,
    private readonly repository: PersistedHealthRepository,
    private readonly syncService: HealthSyncService,
    private readonly recoveryService: RecoveryService,
    private readonly insightsService: InsightsService,
  ) {}

  getStats(): Promise<StoredHealthStats> {
    return this.syncService.getStats();
  }

  async readDay(date: LocalDate, timeZone: string): Promise<DashboardDayData> {
    const [day, insights] = await Promise.all([
      this.recoveryService.readDay(date, timeZone),
      this.insightsService.getInsights('7d', date, timeZone),
    ]);
    return { ...day, insight: insights.insights[0] ?? null };
  }

  async bootstrapDevelopmentDataIfEmpty(stats: StoredHealthStats): Promise<StoredHealthStats> {
    if (!__DEV__ || !(this.provider instanceof MockHealthProvider) || stats.storedDays > 0) return stats;
    await this.syncService.sync(this.provider.getAvailableRange());
    return this.syncService.getStats();
  }

  async refresh(date: LocalDate, timeZone: string): Promise<StoredHealthStats> {
    if (!__DEV__ && this.provider instanceof MockHealthProvider) {
      throw new Error('Synthetic health data cannot be refreshed automatically in production.');
    }
    const range = this.provider instanceof MockHealthProvider
      ? this.provider.getAvailableRange()
      : { start: date, end: date, timeZone };
    await this.syncService.sync(range);
    return this.syncService.getStats();
  }

  canRefreshEmptyDatabase(): boolean {
    return !(this.provider instanceof MockHealthProvider);
  }

  getDevelopmentScenarios(): DevelopmentScenarioState | null {
    if (!__DEV__ || !(this.provider instanceof MockHealthProvider)) return null;
    return {
      current: this.provider.getScenario(),
      options: MOCK_HEALTH_SCENARIOS.map(({ id, label, description }) => ({ id, label, description })),
    };
  }

  async selectDevelopmentScenario(scenario: DevelopmentScenarioId): Promise<StoredHealthStats> {
    if (!__DEV__ || !(this.provider instanceof MockHealthProvider)) {
      throw new Error('Mock scenarios are available only in development.');
    }
    this.provider.setScenario(scenario);
    await resetAndReseedDevelopmentDatabase(this.database, this.syncService, this.provider.getAvailableRange());
    return this.syncService.getStats();
  }
}
