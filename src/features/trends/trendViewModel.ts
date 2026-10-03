import { tr } from '../../localization/i18n';
import type { TrendMetricId, TrendReport, TrendSeries } from '../../models/trends';
import { formatNumber, formatSleepDuration } from '../../shared/formatters/healthFormatters';

export interface TrendCardViewModel {
  metric: TrendMetricId;
  label: string;
  unit: string;
  headline: string;
  latest: string;
  latestDate?: string;
  baseline: string;
  comparison: string;
  coverage: string;
  points: TrendSeries['points'];
}

export interface TrendsViewModel {
  rangeLabel: string;
  cards: TrendCardViewModel[];
  consistency: string;
}

function getLabels(): Record<TrendMetricId, string> { return {
  recovery: tr('metric.recovery'),
  'sleep-duration': tr('metric.sleepDuration'),
  'hrv-rmssd': tr('metric.hrv'),
  'resting-heart-rate': tr('metric.rhrFull'),
  steps: tr('metric.steps'),
}; }

const units: Record<TrendMetricId, string> = {
  recovery: '/ 100',
  'sleep-duration': '',
  'hrv-rmssd': 'ms RMSSD',
  'resting-heart-rate': 'bpm',
  steps: 'steps',
};

function currentValue(series: TrendSeries): number | undefined {
  if (series.comparison.currentValue !== undefined) return series.comparison.currentValue;
  const values = series.points.flatMap((point) => point.status === 'available' && point.value !== undefined ? [point.value] : []);
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  if (series.aggregation === 'median') {
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatted(metric: TrendMetricId, value: number): string {
  if (metric === 'sleep-duration') return formatSleepDuration(Math.round(value));
  return formatNumber(Math.round(value * 10) / 10);
}

function latestPoint(series: TrendSeries) {
  return [...series.points].reverse().find((point) => point.status === 'available' && point.value !== undefined);
}

function baselineCopy(metric: TrendMetricId, series: TrendSeries): string {
  const point = [...series.points].reverse().find((candidate) => candidate.lowerBound !== undefined && candidate.upperBound !== undefined);
  if (!point || point.lowerBound === undefined || point.upperBound === undefined) return tr('common.notAvailable');
  return `${formatted(metric, point.lowerBound)}–${formatted(metric, point.upperBound)}`;
}

function comparisonCopy(series: TrendSeries, days: number): string {
  const comparison = series.comparison;
  if (comparison.direction === 'insufficient-data') return tr('state.noCoverage');
  if (comparison.direction === 'stable') return tr('format.stable', { days });
  const direction = comparison.direction === 'increasing' ? 'format.higher' : 'format.lower';
  const change = Math.abs(comparison.absoluteChange ?? 0);
  if (series.metric === 'sleep-duration') return tr(direction, { value: formatSleepDuration(Math.round(change)) });
  const value = series.metric === 'recovery' ? tr('format.readingPoints', { amount: formatted(series.metric, change) }) : series.metric === 'steps' ? tr('format.readingSteps', { amount: formatted(series.metric, change) }) : `${formatted(series.metric, change)} ${series.unit}`;
  return tr(direction, { value });
}

export function buildTrendsViewModel(report: TrendReport): TrendsViewModel {
  const order: TrendMetricId[] = ['recovery', 'sleep-duration', 'hrv-rmssd', 'resting-heart-rate', 'steps'];
  return {
    rangeLabel: tr('format.period', { count: report.days }),
    cards: order.map((metric) => {
      const series = report.series[metric];
      const value = currentValue(series);
      const latest = latestPoint(series);
      return {
        metric,
        label: getLabels()[metric],
        unit: units[metric],
        headline: value === undefined ? tr('common.noUsableData') : formatted(metric, value),
        latest: latest?.value === undefined ? tr('common.noUsableData') : formatted(metric, latest.value),
        latestDate: latest?.date,
        baseline: baselineCopy(metric, series),
        comparison: comparisonCopy(series, report.days),
        coverage: tr('format.coverage', { available: series.availableDays, expected: series.expectedDays }),
        points: series.points,
      };
    }),
    consistency: report.sleepConsistency.status !== 'available'
      ? tr('state.noBedtimeComparison')
      : report.sleepConsistency.direction === 'stable'
        ? tr('consistency.stable')
        : tr(report.sleepConsistency.direction === 'improving' ? 'consistency.more' : 'consistency.less', { amount: Math.abs(report.sleepConsistency.changeMinutes ?? 0) }),
  };
}
