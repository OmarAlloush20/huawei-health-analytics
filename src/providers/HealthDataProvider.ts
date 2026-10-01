import type {
  AuthorizationResult,
  DailyHealthSummary,
  DateRange,
  HealthDayQuery,
  HealthMetricSource,
  HealthPermission,
  NormalizedHealthData,
} from '../models/health';

export interface HealthDataProvider {
  readonly id: HealthMetricSource;
  readonly displayName: string;

  isAvailable(): Promise<boolean>;
  requestAuthorization(
    permissions: HealthPermission[],
  ): Promise<AuthorizationResult>;
  getDailySummary(query: HealthDayQuery): Promise<DailyHealthSummary | null>;
  getDailySummaries(range: DateRange): Promise<DailyHealthSummary[]>;
  getHealthData(range: DateRange): Promise<NormalizedHealthData>;
}
