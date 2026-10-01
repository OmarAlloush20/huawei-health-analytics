import type { BaselineRelation } from './baseline';
import type { LocalDate } from './health';

export type TrendRangeId = '7d' | '30d' | '90d';
export type TrendMetricId = 'recovery' | 'sleep-duration' | 'hrv-rmssd' | 'resting-heart-rate' | 'steps';
export type TrendDirection = 'increasing' | 'decreasing' | 'stable' | 'insufficient-data';
export type TrendPointStatus = 'available' | 'missing' | 'unsupported' | 'query-failed' | 'not-recorded' | 'not-scorable';

export interface TrendPoint {
  date: LocalDate;
  status: TrendPointStatus;
  value?: number;
  baselineCenter?: number;
  lowerBound?: number;
  upperBound?: number;
  relation?: BaselineRelation;
}

export interface TrendComparison {
  direction: TrendDirection;
  currentValue?: number;
  previousValue?: number;
  absoluteChange?: number;
  relativeChangePercent?: number;
  material: boolean;
  reason?: 'sparse-current-period' | 'sparse-previous-period';
}

export interface TrendSeries {
  metric: TrendMetricId;
  unit: 'points' | 'minutes' | 'ms' | 'bpm' | 'steps';
  aggregation: 'average' | 'median';
  points: TrendPoint[];
  availableDays: number;
  expectedDays: number;
  coveragePercent: number;
  comparison: TrendComparison;
}

export interface SleepConsistencySummary {
  status: 'available' | 'insufficient-data';
  currentAvailableDays: number;
  previousAvailableDays: number;
  currentMeanDeviationMinutes?: number;
  previousMeanDeviationMinutes?: number;
  changeMinutes?: number;
  direction: 'improving' | 'worsening' | 'stable' | 'insufficient-data';
}

export interface TrendReport {
  version: number;
  range: TrendRangeId;
  days: number;
  timeZone: string;
  startDate: LocalDate;
  endDate: LocalDate;
  previousStartDate: LocalDate;
  previousEndDate: LocalDate;
  series: Record<TrendMetricId, TrendSeries>;
  sleepConsistency: SleepConsistencySummary;
}
