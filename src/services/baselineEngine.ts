import type { BaselineMetricId, BaselineResult, DailyBaselineSet } from '../models/baseline';
import type { DailyHealthSummary, HealthMetric, LocalDate } from '../models/health';
import { addLocalDays } from '../shared/dates/healthDates';

export const BASELINE_METHOD = {
  version: 1,
  lookbackDays: 28,
  requiredSampleCount: 14,
  lowerPercentile: 20,
  upperPercentile: 80,
} as const;

interface MetricDefinition {
  id: BaselineMetricId;
  unit: BaselineResult['unit'];
  metric: (summary: DailyHealthSummary) => HealthMetric<unknown>;
  value: (summary: DailyHealthSummary) => number | undefined;
}

const DEFINITIONS: readonly MetricDefinition[] = [
  {
    id: 'hrv-rmssd',
    unit: 'ms',
    metric: (summary) => summary.hrv,
    value: (summary) => summary.hrv.status === 'available' ? summary.hrv.value.averageRmssdMs : undefined,
  },
  {
    id: 'resting-heart-rate',
    unit: 'bpm',
    metric: (summary) => summary.heartRate,
    value: (summary) => summary.heartRate.status === 'available' ? summary.heartRate.value.restingBpm : undefined,
  },
  {
    id: 'sleep-duration',
    unit: 'minutes',
    metric: (summary) => summary.sleep,
    value: (summary) => summary.sleep.status === 'available' ? summary.sleep.value.totalSleepMinutes : undefined,
  },
] as const;

const round = (value: number): number => Math.round(value * 10) / 10;

function percentile(sorted: readonly number[], percentileValue: number): number {
  if (sorted.length === 1) return sorted[0];
  const position = (percentileValue / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(position);
  const fraction = position - lowerIndex;
  const upper = sorted[Math.min(lowerIndex + 1, sorted.length - 1)];
  return sorted[lowerIndex] + (upper - sorted[lowerIndex]) * fraction;
}

function calculateMetric(
  definition: MetricDefinition,
  history: readonly DailyHealthSummary[],
  current: DailyHealthSummary,
  evaluatedDate: LocalDate,
  timeZone: string,
): BaselineResult {
  const historyStartDate = addLocalDays(evaluatedDate, -BASELINE_METHOD.lookbackDays);
  const historyEndDate = addLocalDays(evaluatedDate, -1);
  const observations = history
    .filter((summary) => summary.date >= historyStartDate && summary.date <= historyEndDate)
    .map((summary) => ({ date: summary.date, value: definition.value(summary) }))
    .filter((item): item is { date: LocalDate; value: number } => item.value !== undefined && Number.isFinite(item.value))
    .sort((left, right) => left.date.localeCompare(right.date));
  const currentMetric = definition.metric(current);
  const currentValue = definition.value(current);
  const base: BaselineResult = {
    metric: definition.id,
    status: currentMetric.status === 'unsupported'
      ? 'unavailable'
      : observations.length === 0
        ? 'insufficient-data'
        : observations.length < BASELINE_METHOD.requiredSampleCount ? 'learning' : 'ready',
    unit: definition.unit,
    evaluatedDate,
    timeZone,
    historyStartDate,
    historyEndDate,
    lookbackDays: BASELINE_METHOD.lookbackDays,
    requiredSampleCount: BASELINE_METHOD.requiredSampleCount,
    validSampleCount: observations.length,
    currentStatus: currentMetric.status,
    currentValue,
    lastIncludedDate: observations.at(-1)?.date,
  };

  if (base.status !== 'ready') return base;
  const sorted = observations.map((item) => item.value).sort((left, right) => left - right);
  const center = round(percentile(sorted, 50));
  const lowerBound = round(percentile(sorted, BASELINE_METHOD.lowerPercentile));
  const upperBound = round(percentile(sorted, BASELINE_METHOD.upperPercentile));
  if (currentValue === undefined) return { ...base, center, lowerBound, upperBound };
  const absoluteDifference = round(currentValue - center);
  return {
    ...base,
    center,
    lowerBound,
    upperBound,
    absoluteDifference,
    relativeDifferencePercent: center === 0 ? undefined : round((absoluteDifference / center) * 100),
    relation: currentValue < lowerBound ? 'below-range' : currentValue > upperBound ? 'above-range' : 'within-range',
  };
}

export function calculateDailyBaselines(
  history: readonly DailyHealthSummary[],
  current: DailyHealthSummary,
  evaluatedDate: LocalDate,
  timeZone: string,
): DailyBaselineSet {
  if (current.date !== evaluatedDate || current.timeZone !== timeZone) {
    throw new Error('The current summary must match the evaluated local date and time zone.');
  }
  const [hrv, restingHeartRate, sleepDuration] = DEFINITIONS.map((definition) =>
    calculateMetric(definition, history, current, evaluatedDate, timeZone));
  return { evaluatedDate, timeZone, hrv, restingHeartRate, sleepDuration };
}
