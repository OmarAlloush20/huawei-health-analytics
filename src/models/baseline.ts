import type { HealthMetric, LocalDate } from './health';

export type BaselineMetricId = 'hrv-rmssd' | 'resting-heart-rate' | 'sleep-duration';
export type BaselineStatus = 'unavailable' | 'insufficient-data' | 'learning' | 'ready';
export type BaselineRelation = 'below-range' | 'within-range' | 'above-range';

export interface BaselineResult {
  metric: BaselineMetricId;
  status: BaselineStatus;
  unit: 'ms' | 'bpm' | 'minutes';
  evaluatedDate: LocalDate;
  timeZone: string;
  historyStartDate: LocalDate;
  historyEndDate: LocalDate;
  lookbackDays: number;
  requiredSampleCount: number;
  validSampleCount: number;
  currentStatus: HealthMetric<unknown>['status'];
  currentValue?: number;
  center?: number;
  lowerBound?: number;
  upperBound?: number;
  lastIncludedDate?: LocalDate;
  absoluteDifference?: number;
  relativeDifferencePercent?: number;
  relation?: BaselineRelation;
}

export interface DailyBaselineSet {
  evaluatedDate: LocalDate;
  timeZone: string;
  hrv: BaselineResult;
  restingHeartRate: BaselineResult;
  sleepDuration: BaselineResult;
}
