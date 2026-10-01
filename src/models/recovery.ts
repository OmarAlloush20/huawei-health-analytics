import type { BaselineMetricId, BaselineRelation, BaselineStatus } from './baseline';
import type { HealthMetric, LocalDate } from './health';

export type RecoveryStatus = 'learning' | 'unavailable' | 'partial' | 'ready';
export type RecoveryCompleteness = 'insufficient' | 'partial' | 'complete';
export type RecoveryCategory = 'low' | 'fair' | 'good' | 'high';
export type RecoverySignalStatus = 'used' | 'baseline-learning' | 'baseline-unavailable' | 'today-unavailable' | 'invalid';

export interface RecoverySignalContribution {
  signal: BaselineMetricId;
  status: RecoverySignalStatus;
  configuredWeight: number;
  normalizedWeight?: number;
  baselineStatus: BaselineStatus;
  currentStatus: HealthMetric<unknown>['status'];
  unit: 'ms' | 'bpm' | 'minutes';
  currentValue?: number;
  baselineCenter?: number;
  lowerBound?: number;
  upperBound?: number;
  absoluteDifference?: number;
  relativeDifferencePercent?: number;
  relation?: BaselineRelation;
  signalScore?: number;
  weightedPoints?: number;
  impactFromNeutral?: number;
  reason: string;
}

export interface RecoveryResult {
  version: number;
  evaluatedDate: LocalDate;
  timeZone: string;
  status: RecoveryStatus;
  completeness: RecoveryCompleteness;
  completenessPercent: number;
  usableSignalCount: number;
  requiredSignalCount: number;
  score?: number;
  category?: RecoveryCategory;
  explanation: string;
  contributions: RecoverySignalContribution[];
}
