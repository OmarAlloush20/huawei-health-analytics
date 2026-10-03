import { getLocale, tr } from '../../localization/i18n';
import type { HealthSyncMetadata } from '../../database/types';
import type { BaselineResult } from '../../models/baseline';
import type { DailyHealthSummary, LocalDate } from '../../models/health';
import type { TrendPoint } from '../../models/trends';
import type { RecoverySignalContribution } from '../../models/recovery';
import type { FocusMetric } from '../../repositories/ProductPreferencesRepository';
import { addLocalDays, enumerateLocalDates } from '../../shared/dates/healthDates';
import { formatNumber, formatSleepDuration } from '../../shared/formatters/healthFormatters';

/** A compact daily hero, with a measured copy allowance rather than font shrinking. */
export function getTodayRecoveryLayout(width: number, fontScale: number) {
  const gauge = width < 440 ? 132 : 156;
  const contentWidth = Math.min(width, 720) - (width < 390 ? 32 : 48) - 32;
  const gaugeDiameter = Math.min(280, gauge * Math.max(1, Math.min(fontScale, 1.8)));
  const copyAllowance = 150 * Math.max(1, fontScale);
  return { gauge, stack: fontScale > 1.15 || contentWidth - gaugeDiameter - 12 < copyAllowance, contributorsStack: fontScale > 1.15 };
}

export function formatSelectedDate(date: LocalDate, width: number, fontScale: number): string {
  const compact = width < 390 || fontScale > 1.15;
  return new Intl.DateTimeFormat(getLocale(), { ...(compact ? {} : { weekday: 'short' as const }), month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

export function compactFreshness(sync: HealthSyncMetadata | null, now: Date, mock: boolean): string {
  if (sync?.status === 'running') return tr('state.updating');
  if (sync?.status === 'failed') return tr('state.syncNeeded');
  if (mock) return tr('state.mock');
  if (!sync?.lastSuccessfulAt) return tr('state.syncNeeded');
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(sync.lastSuccessfulAt).getTime()) / 60_000));
  return minutes < 1 ? tr('state.updatedNow') : minutes < 60 ? tr('format.updatedMinutes', { count: minutes }) : minutes < 1440 ? tr('format.updatedHours', { count: Math.floor(minutes / 60) }) : tr('state.cached');
}

export function readingPoints(metric: FocusMetric, history: readonly DailyHealthSummary[], end: LocalDate, timeZone: string, days = 7): TrendPoint[] {
  const byDate = new Map(history.map((day) => [day.date, day]));
  return enumerateLocalDates({ start: addLocalDays(end, -(days - 1)), end, timeZone }).map((date) => {
    const summary = byDate.get(date);
    if (!summary) return { date, status: 'not-recorded' };
    const source = metric === 'hrv' ? summary.hrv : metric === 'rhr' ? summary.heartRate : metric === 'sleep' ? summary.sleep : metric === 'spo2' ? summary.oxygenSaturation : metric === 'stress' ? summary.stress : summary.activity;
    if (source.status !== 'available') return { date, status: source.status };
    let value: number | undefined;
    if (metric === 'hrv' && summary.hrv.status === 'available') value = summary.hrv.value.averageRmssdMs;
    if (metric === 'rhr' && summary.heartRate.status === 'available') value = summary.heartRate.value.restingBpm;
    if (metric === 'sleep' && summary.sleep.status === 'available') value = summary.sleep.value.totalSleepMinutes;
    if (metric === 'spo2' && summary.oxygenSaturation.status === 'available') value = summary.oxygenSaturation.value.averagePercent;
    if (metric === 'stress' && summary.stress.status === 'available') value = summary.stress.value.averageIndex;
    if (metric === 'activity' && summary.activity.status === 'available') value = summary.activity.value.steps;
    return value === undefined ? { date, status: 'missing' } : { date, status: 'available', value };
  });
}

export function shortBaseline(result: BaselineResult | undefined, sleep = false): string {
  if (!result || result.status === 'unavailable') return tr('state.noPersonalRange');
  if (result.status !== 'ready') return tr('format.rangeLearning', { available: result.validSampleCount, required: result.requiredSampleCount });
  if (result.currentStatus !== 'available') return tr('common.noReading');
  if (result.relation === 'within-range') return tr('state.inRange');
  if (sleep && result.absoluteDifference !== undefined) return `${result.absoluteDifference < 0 ? '−' : '+'}${formatSleepDuration(Math.round(Math.abs(result.absoluteDifference)))} vs usual`;
  if (result.metric === 'hrv-rmssd' && result.relativeDifferencePercent !== undefined) return `${result.relativeDifferencePercent < 0 ? '↓' : '↑'} ${formatNumber(Math.abs(result.relativeDifferencePercent))}% vs usual`;
  if (result.absoluteDifference !== undefined) return `${result.absoluteDifference < 0 ? '↓' : '↑'} ${formatNumber(Math.abs(result.absoluteDifference))} bpm vs usual`;
  return tr('common.personalRange');
}

export function contributionContext(item: RecoverySignalContribution): string {
  if (item.lowerBound === undefined || item.upperBound === undefined) return item.reason;
  const bound = (value: number) => item.unit === 'minutes' ? formatSleepDuration(Math.round(value)) : formatNumber(value);
  const relation = item.relation === 'within-range' ? tr('range.withinLower') : item.relation === 'below-range' ? tr('range.belowLower') : item.relation === 'above-range' ? tr('range.aboveLower') : tr('state.noUsableReading');
  const range = `${bound(item.lowerBound)}–${bound(item.upperBound)}${item.unit === 'minutes' ? '' : ` ${item.unit}`}`;
  return item.baselineCenter === undefined ? tr('format.usual', { range, relation }) : tr('format.usualCenter', { range, relation, centerValue: `${bound(item.baselineCenter)}${item.unit === 'minutes' ? '' : ` ${item.unit}`}` });
}

export function contributionWeight(item: RecoverySignalContribution): string {
  const model = Math.round(item.configuredWeight * 100);
  return item.normalizedWeight !== undefined && Math.abs(item.normalizedWeight - item.configuredWeight) > 0.001
    ? tr('format.appliedWeight', { model, applied: formatNumber(Math.round(item.normalizedWeight * 1000) / 10) })
    : tr('format.modelWeight', { count: model });
}
