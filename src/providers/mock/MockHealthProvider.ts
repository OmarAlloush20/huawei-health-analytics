import type {
  AuthorizationResult,
  DailyHealthSummary,
  DateRange,
  HealthDayQuery,
  HealthPermission,
  NormalizedHealthData,
} from '../../models/health';
import type { HealthDataProvider } from '../HealthDataProvider';
import { createMockHealthData, getMockScenarioRange, type MockHealthScenarioId } from './mockHealthData';

export interface MockHealthProviderOptions {
  scenario?: MockHealthScenarioId;
}

export class MockHealthProvider implements HealthDataProvider {
  readonly id = 'mock' as const;
  readonly displayName = 'Mock health data';
  private scenario: MockHealthScenarioId;

  constructor(options: MockHealthProviderOptions = {}) {
    this.scenario = options.scenario ?? 'balanced';
  }

  getScenario(): MockHealthScenarioId {
    return this.scenario;
  }

  setScenario(scenario: MockHealthScenarioId): void {
    this.scenario = scenario;
  }

  getAvailableRange(): DateRange {
    return getMockScenarioRange(this.scenario);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async requestAuthorization(
    permissions: HealthPermission[],
  ): Promise<AuthorizationResult> {
    return { granted: [...permissions], denied: [] };
  }

  async getDailySummary(query: HealthDayQuery): Promise<DailyHealthSummary | null> {
    const data = createMockHealthData(this.scenario, {
      start: query.date,
      end: query.date,
      timeZone: query.timeZone,
    });
    return data.dailySummaries.status === 'available'
      ? data.dailySummaries.value[0] ?? null
      : null;
  }

  async getDailySummaries(range: DateRange): Promise<DailyHealthSummary[]> {
    const data = createMockHealthData(this.scenario, range);
    return data.dailySummaries.status === 'available' ? data.dailySummaries.value : [];
  }

  async getHealthData(range: DateRange): Promise<NormalizedHealthData> {
    return createMockHealthData(this.scenario, range);
  }
}
