import type { DeterministicInsight, InsightsResult } from '../models/insights';
import type { TrendMetricId, TrendReport, TrendSeries } from '../models/trends';

export const INSIGHTS_CONFIG = {
  version: 1,
  minimumStreakDays: 3,
  maximumVisibleInsights: 3,
} as const;

const labels: Record<TrendMetricId, string> = {
  recovery: 'Recovery',
  'sleep-duration': 'Sleep',
  'hrv-rmssd': 'HRV',
  'resting-heart-rate': 'Resting heart rate',
  steps: 'Steps',
};

const units: Record<TrendMetricId, string> = {
  recovery: 'points',
  'sleep-duration': 'minutes',
  'hrv-rmssd': 'ms',
  'resting-heart-rate': 'bpm',
  steps: 'steps',
};

function persistentInsight(report: TrendReport, metric: 'hrv-rmssd' | 'resting-heart-rate' | 'sleep-duration'): DeterministicInsight | null {
  const adverseRelation = metric === 'resting-heart-rate' ? 'above-range' : 'below-range';
  let count = 0;
  for (let index = report.series[metric].points.length - 1; index >= 0; index -= 1) {
    const point = report.series[metric].points[index];
    if (point.status !== 'available' || point.relation !== adverseRelation) break;
    count += 1;
  }
  if (count < INSIGHTS_CONFIG.minimumStreakDays) return null;
  const wording = metric === 'sleep-duration' ? 'shorter than' : adverseRelation === 'above-range' ? 'above' : 'below';
  return {
    version: INSIGHTS_CONFIG.version,
    ruleId: `persistent-${metric}-v1`,
    type: 'persistent-deviation',
    metric,
    importance: 'notable',
    title: `${labels[metric]} has stayed ${wording} your recent range`,
    explanation: `${labels[metric]} was ${wording} its personal typical range for ${count} consecutive recorded ${count === 1 ? 'day' : 'days'}.`,
    range: report.range,
    startDate: report.series[metric].points.at(-count)!.date,
    endDate: report.endDate,
    priority: 100 + count,
    evidence: { consecutiveDays: count, availableDays: report.series[metric].availableDays, expectedDays: report.days, unit: units[metric] },
  };
}

function comparisonExplanation(series: TrendSeries, report: TrendReport): string {
  const change = Math.abs(series.comparison.absoluteChange!);
  const direction = series.comparison.direction === 'increasing' ? 'higher' : 'lower';
  if (series.metric === 'sleep-duration') return `Average sleep was ${Math.round(change)} minutes ${direction} than the previous ${report.days} days.`;
  if (series.metric === 'hrv-rmssd') return `Median HRV was ${Math.abs(series.comparison.relativeChangePercent ?? 0)}% ${direction} than the previous period.`;
  if (series.metric === 'resting-heart-rate') return `Average resting heart rate was ${change} bpm ${direction} than the previous period.`;
  if (series.metric === 'steps') return `Average steps were ${Math.round(change).toLocaleString('en-US')} ${direction} than the previous period.`;
  return `Average Recovery was ${change} points ${direction} than the previous period.`;
}

function comparisonInsight(report: TrendReport, series: TrendSeries): DeterministicInsight | null {
  if (!series.comparison.material || series.comparison.direction === 'insufficient-data' || series.comparison.direction === 'stable') return null;
  const direction = series.comparison.direction === 'increasing' ? 'increased' : 'decreased';
  const magnitudeBonus = Math.min(20, Math.abs(series.comparison.relativeChangePercent ?? 0));
  const basePriority = series.metric === 'recovery' ? 85 : series.metric === 'steps' ? 60 : 70;
  return {
    version: INSIGHTS_CONFIG.version,
    ruleId: `period-${series.metric}-v1`,
    type: 'period-comparison',
    metric: series.metric,
    importance: 'informational',
    title: `${labels[series.metric]} ${direction}`,
    explanation: comparisonExplanation(series, report),
    range: report.range,
    startDate: report.startDate,
    endDate: report.endDate,
    priority: basePriority + magnitudeBonus,
    evidence: {
      currentValue: series.comparison.currentValue,
      previousValue: series.comparison.previousValue,
      absoluteChange: series.comparison.absoluteChange,
      relativeChangePercent: series.comparison.relativeChangePercent,
      availableDays: series.availableDays,
      expectedDays: series.expectedDays,
      unit: units[series.metric],
    },
  };
}

function consistencyInsight(report: TrendReport): DeterministicInsight | null {
  const consistency = report.sleepConsistency;
  if (consistency.status !== 'available' || consistency.direction === 'stable' || consistency.direction === 'insufficient-data') return null;
  const improved = consistency.direction === 'improving';
  return {
    version: INSIGHTS_CONFIG.version,
    ruleId: 'bedtime-consistency-v1',
    type: 'sleep-consistency',
    metric: 'sleep-duration',
    importance: 'informational',
    title: `Bedtime became ${improved ? 'more' : 'less'} consistent`,
    explanation: `Typical bedtime variation was ${Math.abs(consistency.changeMinutes!)} minutes ${improved ? 'lower' : 'higher'} than the previous period.`,
    range: report.range,
    startDate: report.startDate,
    endDate: report.endDate,
    priority: 55,
    evidence: { currentValue: consistency.currentMeanDeviationMinutes, previousValue: consistency.previousMeanDeviationMinutes, absoluteChange: consistency.changeMinutes, availableDays: consistency.currentAvailableDays, expectedDays: report.days, unit: 'minutes' },
  };
}

export function generateInsights(report: TrendReport): InsightsResult {
  const candidates = [
    persistentInsight(report, 'hrv-rmssd'),
    persistentInsight(report, 'resting-heart-rate'),
    persistentInsight(report, 'sleep-duration'),
    ...Object.values(report.series).map((series) => comparisonInsight(report, series)),
    consistencyInsight(report),
  ].filter((item): item is DeterministicInsight => item !== null);
  const insights = candidates
    .sort((left, right) => right.priority - left.priority || left.ruleId.localeCompare(right.ruleId))
    .slice(0, INSIGHTS_CONFIG.maximumVisibleInsights);
  return { version: INSIGHTS_CONFIG.version, range: report.range, generatedForDate: report.endDate, insights };
}
