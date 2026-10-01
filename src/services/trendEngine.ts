import type { BaselineResult, DailyBaselineSet } from '../models/baseline';
import type { DailyHealthSummary, HealthMetric, LocalDate } from '../models/health';
import type {
  SleepConsistencySummary,
  TrendComparison,
  TrendMetricId,
  TrendPoint,
  TrendPointStatus,
  TrendRangeId,
  TrendReport,
  TrendSeries,
} from '../models/trends';
import { addLocalDays, enumerateLocalDates } from '../shared/dates/healthDates';
import { calculateDailyBaselines } from './baselineEngine';
import { calculateRecovery } from './recoveryEngine';

export const TREND_CONFIG = {
  version: 1,
  ranges: { '7d': 7, '30d': 30, '90d': 90 },
  minimumCoverageRatio: 0.5,
  minimumComparisonDays: 3,
  materiality: {
    recoveryPoints: 5,
    sleepMinutes: 20,
    hrvPercent: 5,
    restingHeartRateBpm: 2,
    stepsPercent: 10,
    stepsAbsolute: 500,
    sleepConsistencyMinutes: 15,
  },
} as const;

interface MetricDefinition {
  metric: TrendMetricId;
  unit: TrendSeries['unit'];
  aggregation: TrendSeries['aggregation'];
}

const DEFINITIONS: readonly MetricDefinition[] = [
  { metric: 'recovery', unit: 'points', aggregation: 'average' },
  { metric: 'sleep-duration', unit: 'minutes', aggregation: 'average' },
  { metric: 'hrv-rmssd', unit: 'ms', aggregation: 'median' },
  { metric: 'resting-heart-rate', unit: 'bpm', aggregation: 'average' },
  { metric: 'steps', unit: 'steps', aggregation: 'average' },
] as const;

const round = (value: number, decimals = 1) => Math.round(value * 10 ** decimals) / 10 ** decimals;

function metricStatus(metric: HealthMetric<unknown>): TrendPointStatus {
  return metric.status;
}

function baselineFor(metric: TrendMetricId, baselines: DailyBaselineSet): BaselineResult | undefined {
  if (metric === 'hrv-rmssd') return baselines.hrv;
  if (metric === 'resting-heart-rate') return baselines.restingHeartRate;
  if (metric === 'sleep-duration') return baselines.sleepDuration;
  return undefined;
}

function pointFor(metric: TrendMetricId, date: LocalDate, summary?: DailyHealthSummary, baselines?: DailyBaselineSet): TrendPoint {
  if (!summary) return { date, status: 'not-recorded' };
  if (metric === 'recovery') {
    if (!baselines) return { date, status: 'not-scorable' };
    const recovery = calculateRecovery(baselines);
    return recovery.score === undefined ? { date, status: 'not-scorable' } : { date, status: 'available', value: recovery.score };
  }
  const baseline = baselines ? baselineFor(metric, baselines) : undefined;
  const context = baseline?.status === 'ready' ? {
    baselineCenter: baseline.center,
    lowerBound: baseline.lowerBound,
    upperBound: baseline.upperBound,
    relation: baseline.relation,
  } : {};
  if (metric === 'sleep-duration') return summary.sleep.status === 'available'
    ? { date, status: 'available', value: summary.sleep.value.totalSleepMinutes, ...context }
    : { date, status: metricStatus(summary.sleep), ...context };
  if (metric === 'hrv-rmssd') return summary.hrv.status === 'available'
    ? { date, status: 'available', value: summary.hrv.value.averageRmssdMs, ...context }
    : { date, status: metricStatus(summary.hrv), ...context };
  if (metric === 'resting-heart-rate') {
    if (summary.heartRate.status !== 'available') return { date, status: metricStatus(summary.heartRate), ...context };
    return summary.heartRate.value.restingBpm === undefined
      ? { date, status: 'missing', ...context }
      : { date, status: 'available', value: summary.heartRate.value.restingBpm, ...context };
  }
  return summary.activity.status === 'available'
    ? { date, status: 'available', value: summary.activity.value.steps }
    : { date, status: metricStatus(summary.activity) };
}

function aggregate(values: readonly number[], method: TrendSeries['aggregation']): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  if (method === 'median') {
    const middle = Math.floor(sorted.length / 2);
    return round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
  }
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function threshold(metric: TrendMetricId, previous: number): number {
  if (metric === 'recovery') return TREND_CONFIG.materiality.recoveryPoints;
  if (metric === 'sleep-duration') return TREND_CONFIG.materiality.sleepMinutes;
  if (metric === 'hrv-rmssd') return Math.abs(previous) * TREND_CONFIG.materiality.hrvPercent / 100;
  if (metric === 'resting-heart-rate') return TREND_CONFIG.materiality.restingHeartRateBpm;
  return Math.max(TREND_CONFIG.materiality.stepsAbsolute, Math.abs(previous) * TREND_CONFIG.materiality.stepsPercent / 100);
}

function hasCoverage(available: number, expected: number): boolean {
  return available >= TREND_CONFIG.minimumComparisonDays && available / expected >= TREND_CONFIG.minimumCoverageRatio;
}

function comparison(metric: TrendMetricId, current: readonly TrendPoint[], previous: readonly TrendPoint[], aggregation: TrendSeries['aggregation']): TrendComparison {
  const currentValues = current.flatMap((point) => point.status === 'available' && point.value !== undefined ? [point.value] : []);
  const previousValues = previous.flatMap((point) => point.status === 'available' && point.value !== undefined ? [point.value] : []);
  if (!hasCoverage(currentValues.length, current.length)) return { direction: 'insufficient-data', material: false, reason: 'sparse-current-period' };
  if (!hasCoverage(previousValues.length, previous.length)) return { direction: 'insufficient-data', material: false, reason: 'sparse-previous-period' };
  const currentValue = aggregate(currentValues, aggregation)!;
  const previousValue = aggregate(previousValues, aggregation)!;
  const absoluteChange = round(currentValue - previousValue);
  const relativeChangePercent = previousValue === 0 ? undefined : round(absoluteChange / previousValue * 100);
  const material = Math.abs(absoluteChange) >= threshold(metric, previousValue);
  return {
    direction: !material ? 'stable' : absoluteChange > 0 ? 'increasing' : 'decreasing',
    currentValue,
    previousValue,
    absoluteChange,
    relativeChangePercent,
    material,
  };
}

function clockMinutes(timestamp: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return value('hour') * 60 + value('minute');
}

function circularDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, 1_440 - distance);
}

function bedtimeDeviation(summaries: readonly DailyHealthSummary[], timeZone: string): { value?: number; count: number } {
  const minutes = summaries.flatMap((summary) => summary.sleep.status === 'available' && summary.sleep.value.bedtime
    ? [clockMinutes(summary.sleep.value.bedtime, timeZone)] : []);
  if (!minutes.length) return { count: 0 };
  const radians = minutes.map((value) => value / 1_440 * Math.PI * 2);
  const meanAngle = Math.atan2(radians.reduce((sum, value) => sum + Math.sin(value), 0), radians.reduce((sum, value) => sum + Math.cos(value), 0));
  const meanMinutes = ((meanAngle < 0 ? meanAngle + Math.PI * 2 : meanAngle) / (Math.PI * 2)) * 1_440;
  return { value: round(minutes.reduce((sum, value) => sum + circularDistance(value, meanMinutes), 0) / minutes.length), count: minutes.length };
}

function sleepConsistency(current: readonly DailyHealthSummary[], previous: readonly DailyHealthSummary[], days: number, timeZone: string): SleepConsistencySummary {
  const currentResult = bedtimeDeviation(current, timeZone);
  const previousResult = bedtimeDeviation(previous, timeZone);
  if (!hasCoverage(currentResult.count, days) || !hasCoverage(previousResult.count, days)) {
    return { status: 'insufficient-data', currentAvailableDays: currentResult.count, previousAvailableDays: previousResult.count, direction: 'insufficient-data' };
  }
  const changeMinutes = round(currentResult.value! - previousResult.value!);
  const material = Math.abs(changeMinutes) >= TREND_CONFIG.materiality.sleepConsistencyMinutes;
  return {
    status: 'available',
    currentAvailableDays: currentResult.count,
    previousAvailableDays: previousResult.count,
    currentMeanDeviationMinutes: currentResult.value,
    previousMeanDeviationMinutes: previousResult.value,
    changeMinutes,
    direction: !material ? 'stable' : changeMinutes < 0 ? 'improving' : 'worsening',
  };
}

export function buildTrendReport(range: TrendRangeId, endDate: LocalDate, timeZone: string, history: readonly DailyHealthSummary[]): TrendReport {
  const days = TREND_CONFIG.ranges[range];
  const startDate = addLocalDays(endDate, -(days - 1));
  const previousEndDate = addLocalDays(startDate, -1);
  const previousStartDate = addLocalDays(previousEndDate, -(days - 1));
  const byDate = new Map(history.filter((item) => item.timeZone === timeZone).map((item) => [item.date, item]));
  const baselineByDate = new Map<LocalDate, DailyBaselineSet>();
  for (const summary of history) {
    if (summary.timeZone !== timeZone || summary.date > endDate) continue;
    const preceding = history.filter((item) => item.timeZone === timeZone && item.date >= addLocalDays(summary.date, -28) && item.date < summary.date);
    baselineByDate.set(summary.date, calculateDailyBaselines(preceding, summary, summary.date, timeZone));
  }
  const currentDates = enumerateLocalDates({ start: startDate, end: endDate, timeZone });
  const previousDates = enumerateLocalDates({ start: previousStartDate, end: previousEndDate, timeZone });
  const series = Object.fromEntries(DEFINITIONS.map((definition) => {
    const current = currentDates.map((date) => pointFor(definition.metric, date, byDate.get(date), baselineByDate.get(date)));
    const previous = previousDates.map((date) => pointFor(definition.metric, date, byDate.get(date), baselineByDate.get(date)));
    const availableDays = current.filter((point) => point.status === 'available').length;
    return [definition.metric, {
      ...definition,
      points: current,
      availableDays,
      expectedDays: days,
      coveragePercent: Math.round(availableDays / days * 100),
      comparison: comparison(definition.metric, current, previous, definition.aggregation),
    } satisfies TrendSeries];
  })) as Record<TrendMetricId, TrendSeries>;
  const currentSummaries = currentDates.flatMap((date) => byDate.get(date) ? [byDate.get(date)!] : []);
  const previousSummaries = previousDates.flatMap((date) => byDate.get(date) ? [byDate.get(date)!] : []);
  return {
    version: TREND_CONFIG.version,
    range,
    days,
    timeZone,
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    series,
    sleepConsistency: sleepConsistency(currentSummaries, previousSummaries, days, timeZone),
  };
}
