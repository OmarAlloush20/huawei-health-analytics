import type { DailyHealthSummary, LocalDate } from '../../models/health';
import type { TrendPoint } from '../../models/trends';
import { addLocalDays, enumerateLocalDates } from '../../shared/dates/healthDates';

export type MetricRoute = 'recovery' | 'sleep' | 'hrv' | 'rhr' | 'spo2' | 'stress' | 'activity';

export interface MetricPeriodSummary {
  latest?: TrendPoint;
  average?: number;
  availableDays: number;
  expectedDays: number;
}

export function buildRawMetricPoints(metric: 'spo2' | 'stress', summaries: readonly DailyHealthSummary[], endDate: LocalDate, days: number, timeZone: string): TrendPoint[] {
  const byDate = new Map(summaries.map((summary) => [summary.date, summary]));
  return enumerateLocalDates({ start: addLocalDays(endDate, -(days - 1)), end: endDate, timeZone }).map((date) => {
    const summary = byDate.get(date);
    if (!summary) return { date, status: 'not-recorded' };
    if (metric === 'spo2') {
      const source = summary.oxygenSaturation;
      return source.status === 'available' ? { date, status: 'available', value: source.value.averagePercent } : { date, status: source.status };
    }
    const source = summary.stress;
    return source.status === 'available' ? { date, status: 'available', value: source.value.averageIndex } : { date, status: source.status };
  });
}

export function summarizeMetricPoints(points: readonly TrendPoint[]): MetricPeriodSummary {
  const available = points.filter((point): point is TrendPoint & { value: number } => point.status === 'available' && point.value !== undefined);
  return {
    latest: available.at(-1),
    average: available.length ? available.reduce((total, point) => total + point.value, 0) / available.length : undefined,
    availableDays: available.length,
    expectedDays: points.length,
  };
}
