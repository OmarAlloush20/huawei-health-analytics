import type { TrendMetricId, TrendReport, TrendSeries } from '../../models/trends';
import { formatNumber, formatSleepDuration } from '../../shared/formatters/healthFormatters';

export interface TrendCardViewModel {
  metric: TrendMetricId;
  label: string;
  unit: string;
  headline: string;
  comparison: string;
  coverage: string;
  points: TrendSeries['points'];
}

export interface TrendsViewModel {
  rangeLabel: string;
  cards: TrendCardViewModel[];
  consistency: string;
}

const labels: Record<TrendMetricId, string> = {
  recovery: 'Recovery',
  'sleep-duration': 'Sleep duration',
  'hrv-rmssd': 'HRV',
  'resting-heart-rate': 'Resting heart rate',
  steps: 'Steps',
};

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

function comparisonCopy(series: TrendSeries, days: number): string {
  const comparison = series.comparison;
  if (comparison.direction === 'insufficient-data') return 'Not enough coverage for the previous-period comparison';
  if (comparison.direction === 'stable') return `Stable versus the previous ${days} days`;
  const direction = comparison.direction === 'increasing' ? 'higher' : 'lower';
  const change = Math.abs(comparison.absoluteChange ?? 0);
  if (series.metric === 'sleep-duration') return `${formatSleepDuration(Math.round(change))} ${direction} than the previous period`;
  const unit = series.metric === 'recovery' ? 'points' : series.unit;
  return `${formatted(series.metric, change)} ${unit} ${direction} than the previous period`;
}

export function buildTrendsViewModel(report: TrendReport): TrendsViewModel {
  const order: TrendMetricId[] = ['recovery', 'sleep-duration', 'hrv-rmssd', 'resting-heart-rate', 'steps'];
  return {
    rangeLabel: `${report.days}-day view`,
    cards: order.map((metric) => {
      const series = report.series[metric];
      const value = currentValue(series);
      return {
        metric,
        label: labels[metric],
        unit: units[metric],
        headline: value === undefined ? 'No usable data' : formatted(metric, value),
        comparison: comparisonCopy(series, report.days),
        coverage: `${series.availableDays} of ${series.expectedDays} days available`,
        points: series.points,
      };
    }),
    consistency: report.sleepConsistency.status !== 'available'
      ? 'Not enough bedtime data for a consistency comparison'
      : report.sleepConsistency.direction === 'stable'
        ? 'Bedtime consistency was stable versus the previous period'
        : `Bedtime was ${report.sleepConsistency.direction === 'improving' ? 'more' : 'less'} consistent by ${Math.abs(report.sleepConsistency.changeMinutes ?? 0)} minutes`,
  };
}
