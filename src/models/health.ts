export type HealthMetricSource = 'mock' | 'huawei' | 'health-connect';
export type LocalDate = string;
export type IsoTimestamp = string;

export type HealthPermission =
  | 'steps:read'
  | 'heart-rate:read'
  | 'sleep:read'
  | 'hrv:read'
  | 'oxygen-saturation:read'
  | 'stress:read'
  | 'activity:read';

export interface AuthorizationResult {
  granted: HealthPermission[];
  denied: HealthPermission[];
}

export interface HealthDayQuery {
  date: LocalDate;
  timeZone: string;
}

export interface DateRange {
  start: LocalDate;
  end: LocalDate;
  timeZone: string;
}

export interface DataProvenance {
  provider: HealthMetricSource;
  recordedBy: 'wearable' | 'phone' | 'manual' | 'synthetic' | 'unknown';
  aggregation: 'raw' | 'daily' | 'derived';
  syncedAt: IsoTimestamp;
  sourceId?: string;
}

export interface AvailableHealthMetric<T> {
  status: 'available';
  value: T;
  provenance: DataProvenance;
}

export interface UnavailableHealthMetric {
  status: 'missing' | 'unsupported';
  reason: string;
  provenance: DataProvenance;
}

export interface FailedHealthMetric {
  status: 'query-failed';
  reason: string;
  errorCode?: string;
  provenance: DataProvenance;
}

export type HealthMetric<T> =
  | AvailableHealthMetric<T>
  | UnavailableHealthMetric
  | FailedHealthMetric;

export type SleepStageType = 'awake' | 'light' | 'deep' | 'rem' | 'unknown';

export interface SleepStage {
  stage: SleepStageType;
  startTime: IsoTimestamp;
  endTime: IsoTimestamp;
  durationMinutes: number;
}

export interface SleepSession {
  id: string;
  date: LocalDate;
  startTime: IsoTimestamp;
  endTime: IsoTimestamp;
  durationMinutes: number;
  timeInBedMinutes: number;
  stages: SleepStage[];
  score?: number;
  interruptions?: number;
  averageBreathingRatePerMinute?: number;
  provenance: DataProvenance;
}

export interface SleepDailySummary {
  totalSleepMinutes: number;
  timeInBedMinutes: number;
  awakeMinutes: number;
  lightMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  score?: number;
  bedtime?: IsoTimestamp;
  wakeTime?: IsoTimestamp;
}

export interface HeartRateSample {
  timestamp: IsoTimestamp;
  beatsPerMinute: number;
  context: 'resting' | 'active' | 'sleep' | 'unknown';
  provenance: DataProvenance;
}

export interface HeartRateDailySummary {
  minimumBpm: number;
  maximumBpm: number;
  averageBpm: number;
  restingBpm?: number;
}

export interface HrvObservation {
  timestamp: IsoTimestamp;
  rmssdMs: number;
  context: 'sleep' | 'resting' | 'unknown';
  provenance: DataProvenance;
}

export interface HrvDailySummary {
  averageRmssdMs: number;
  minimumRmssdMs: number;
  maximumRmssdMs: number;
  observationCount: number;
}

export interface OxygenSaturationSample {
  timestamp: IsoTimestamp;
  percentage: number;
  context: 'sleep' | 'resting' | 'unknown';
  provenance: DataProvenance;
}

export interface OxygenSaturationDailySummary {
  averagePercent: number;
  minimumPercent: number;
  maximumPercent: number;
  observationCount: number;
}

export interface StressDailySummary {
  averageIndex: number;
  minimumIndex: number;
  maximumIndex: number;
  observationCount: number;
}

export type WorkoutType =
  | 'walking'
  | 'running'
  | 'cycling'
  | 'strength'
  | 'other';

export interface WorkoutSession {
  id: string;
  date: LocalDate;
  type: WorkoutType;
  startTime: IsoTimestamp;
  endTime: IsoTimestamp;
  durationMinutes: number;
  activeEnergyKcal?: number;
  distanceMeters?: number;
  averageHeartRateBpm?: number;
  provenance: DataProvenance;
}

export interface DailyActivitySummary {
  steps: number;
  activeEnergyKcal?: number;
  activeDurationMinutes?: number;
  distanceMeters?: number;
  workoutCount?: number;
}

export interface ActivityLoadPlaceholder {
  state: 'not-calculated';
  reason: 'deferred-to-later-milestone';
}

export type DailyMetricKey =
  | 'activity'
  | 'sleep'
  | 'heartRate'
  | 'hrv'
  | 'oxygenSaturation'
  | 'stress'
  | 'activityLoad';

export interface DataCompleteness {
  available: DailyMetricKey[];
  missing: DailyMetricKey[];
  unsupported: DailyMetricKey[];
  queryFailed: DailyMetricKey[];
  availableRatio: number;
}

export interface DailyHealthSummary {
  date: LocalDate;
  timeZone: string;
  source: HealthMetricSource;
  activity: HealthMetric<DailyActivitySummary>;
  sleep: HealthMetric<SleepDailySummary>;
  heartRate: HealthMetric<HeartRateDailySummary>;
  hrv: HealthMetric<HrvDailySummary>;
  oxygenSaturation: HealthMetric<OxygenSaturationDailySummary>;
  stress: HealthMetric<StressDailySummary>;
  activityLoad: HealthMetric<ActivityLoadPlaceholder>;
  completeness: DataCompleteness;
}

export interface NormalizedHealthData {
  range: DateRange;
  dailySummaries: HealthMetric<DailyHealthSummary[]>;
  sleepSessions: HealthMetric<SleepSession[]>;
  heartRateSamples: HealthMetric<HeartRateSample[]>;
  hrvObservations: HealthMetric<HrvObservation[]>;
  oxygenSaturationSamples: HealthMetric<OxygenSaturationSample[]>;
  workouts: HealthMetric<WorkoutSession[]>;
}
