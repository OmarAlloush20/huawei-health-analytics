import { getLocale, tr } from '../../localization/i18n';
import type { HealthSyncMetadata } from '../../database/types';
import type { BaselineResult, DailyBaselineSet } from '../../models/baseline';
import type { DailyHealthSummary, HealthMetric, LocalDate } from '../../models/health';
import type { RecoveryResult, RecoverySignalContribution } from '../../models/recovery';
import type { DeterministicInsight } from '../../models/insights';
import { addLocalDays, parseLocalDate } from '../../shared/dates/healthDates';
import { formatNumber, formatSleepDuration } from '../../shared/formatters/healthFormatters';

export type MetricAvailability = HealthMetric<unknown>['status'];

export interface MetricDisplay {
  status: MetricAvailability;
  value: string;
  unit?: string;
  detail?: string;
  comparison?: string;
  baselineDetail?: string;
}

export interface DashboardViewModel {
  date: LocalDate;
  dateLabel: string;
  sleep: MetricDisplay & { stages?: string };
  hrv: MetricDisplay;
  restingHeartRate: MetricDisplay;
  oxygenSaturation: MetricDisplay;
  stress: MetricDisplay;
  activity: MetricDisplay & { facts: string[] };
  recovery: RecoveryDisplay;
  insight: { available: boolean; title: string; detail: string };
}

export interface RecoveryDetailDisplay {
  signal: string;
  status: RecoverySignalContribution['status'];
  current?: string;
  baseline?: string;
  typicalRange?: string;
  contribution?: string;
  weight?: string;
  reason: string;
}

export interface RecoveryDisplay {
  state: 'learning' | 'ready' | 'partial' | 'unavailable';
  title: string;
  category?: string;
  completeness?: string;
  detail: string;
  details: RecoveryDetailDisplay[];
}

const unavailableText: Record<Exclude<MetricAvailability, 'available'>, string> = {
  missing: tr('common.noData'),
  unsupported: tr('state.sourceUnsupported'),
  'query-failed': tr('state.loadFailed'),
};

function displayMetric<T>(metric: HealthMetric<T>, format: (value: T) => Omit<MetricDisplay, 'status'>): MetricDisplay {
  if (metric.status === 'available') return { status: 'available', ...format(metric.value) };
  return { status: metric.status, value: unavailableText[metric.status] };
}

function formatClock(timestamp: string | undefined, timeZone: string): string | undefined {
  if (!timestamp) return undefined;
  return new Intl.DateTimeFormat(getLocale(), {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function baselineCopy(result: BaselineResult, kind: 'hrv' | 'rhr' | 'sleep'): Pick<MetricDisplay, 'comparison' | 'baselineDetail'> {
  if (result.status === 'unavailable') return { comparison: tr('baseline.sourceUnavailable') };
  if (result.status === 'insufficient-data') return { comparison: tr('baseline.needsHistory') };
  if (result.status === 'learning') {
    return { comparison: `Learning baseline - ${result.validSampleCount} of ${result.requiredSampleCount} valid days` };
  }
  const formatValue = (value: number) => kind === 'sleep'
    ? formatSleepDuration(Math.round(value))
    : `${formatNumber(value)} ${kind === 'hrv' ? 'ms' : 'bpm'}`;
  const baselineDetail = result.lowerBound === undefined || result.upperBound === undefined
    ? undefined
    : `Typical ${formatValue(result.lowerBound)}-${formatValue(result.upperBound)} · ${result.validSampleCount} valid days`;
  if (result.currentStatus !== 'available' || result.relation === undefined) return { baselineDetail };
  if (result.relation === 'within-range') return { comparison: tr('baseline.inRange'), baselineDetail };
  const direction = result.relation === 'below-range' ? 'below' : 'above';
  if (kind === 'hrv' && result.relativeDifferencePercent !== undefined) {
    return { comparison: `${formatNumber(Math.abs(result.relativeDifferencePercent))}% ${direction} your recent baseline`, baselineDetail };
  }
  if (kind === 'sleep' && result.absoluteDifference !== undefined) {
    return { comparison: `${formatSleepDuration(Math.round(Math.abs(result.absoluteDifference)))} ${direction === 'below' ? 'shorter' : 'longer'} than your recent baseline`, baselineDetail };
  }
  return result.absoluteDifference === undefined
    ? { baselineDetail }
    : { comparison: `${formatNumber(Math.abs(result.absoluteDifference))} bpm ${direction} your recent baseline`, baselineDetail };
}

function formatRecoveryValue(value: number, unit: RecoverySignalContribution['unit']): string {
  if (unit === 'minutes') return formatSleepDuration(Math.round(value));
  return `${formatNumber(value)} ${unit}`;
}

function recoverySignalLabel(signal: RecoverySignalContribution['signal']): string {
  if (signal === 'hrv-rmssd') return tr('metric.hrv');
  if (signal === 'resting-heart-rate') return tr('metric.rhrFull');
  return tr('metric.sleepDuration');
}

function recoveryDetails(result: RecoveryResult): RecoveryDetailDisplay[] {
  return result.contributions.map((item) => ({
    signal: recoverySignalLabel(item.signal),
    status: item.status,
    current: item.currentValue === undefined ? undefined : formatRecoveryValue(item.currentValue, item.unit),
    baseline: item.baselineCenter === undefined ? undefined : formatRecoveryValue(item.baselineCenter, item.unit),
    typicalRange: item.lowerBound === undefined || item.upperBound === undefined
      ? undefined
      : `${formatRecoveryValue(item.lowerBound, item.unit)}-${formatRecoveryValue(item.upperBound, item.unit)}`,
    contribution: item.impactFromNeutral === undefined
      ? undefined
      : `${item.impactFromNeutral > 0 ? '+' : ''}${formatNumber(item.impactFromNeutral)} pts vs neutral`,
    weight: item.normalizedWeight === undefined ? undefined : `${Math.round(item.normalizedWeight * 100)}% applied weight`,
    reason: item.reason,
  }));
}

function recoveryCopy(baselines?: DailyBaselineSet, recovery?: RecoveryResult): DashboardViewModel['recovery'] {
  if (recovery?.score !== undefined && recovery.category) {
    const category = tr(`recovery.${recovery.category}`);
    const completeness = recovery.completeness === 'complete'
      ? '100% inputs'
      : `${recovery.completenessPercent}% inputs`;
    return {
      state: recovery.status === 'partial' ? 'partial' : 'ready',
      title: `${recovery.score} / 100`,
      category,
      completeness,
      detail: recovery.explanation,
      details: recoveryDetails(recovery),
    };
  }
  if (!baselines) return { state: 'learning', title: tr('recovery.learning'), detail: tr('baseline.referenceHelp'), details: [] };
  const required = [baselines.hrv, baselines.restingHeartRate, baselines.sleepDuration];
  if (required.every((result) => result.status === 'ready')) {
    return { state: 'unavailable', title: tr('recovery.unavailable'), detail: recovery?.explanation ?? tr('recovery.twoNeeded'), details: recovery ? recoveryDetails(recovery) : [] };
  }
  if (required.some((result) => result.status === 'unavailable')) {
    return { state: 'unavailable', title: tr('recovery.unavailable'), detail: recovery?.explanation ?? tr('recovery.sourceInsufficient'), details: recovery ? recoveryDetails(recovery) : [] };
  }
  const validDays = Math.min(...required.map((result) => result.validSampleCount));
  return { state: 'learning', title: tr('recovery.learning'), detail: `${validDays} of ${required[0].requiredSampleCount} valid days across required signals.`, details: recovery ? recoveryDetails(recovery) : [] };
}

export function buildDashboardViewModel(summary: DailyHealthSummary, today: LocalDate, baselines?: DailyBaselineSet, recovery?: RecoveryResult, insight?: DeterministicInsight): DashboardViewModel {
  const sleep = displayMetric(summary.sleep, (value) => {
    const bedtime = formatClock(value.bedtime, summary.timeZone);
    const wakeTime = formatClock(value.wakeTime, summary.timeZone);
    return {
      value: formatSleepDuration(value.totalSleepMinutes),
      detail: bedtime && wakeTime ? `${bedtime} – ${wakeTime}` : undefined,
    };
  });
  const sleepStages = summary.sleep.status === 'available'
    ? `Deep ${formatSleepDuration(summary.sleep.value.deepMinutes)}  ·  REM ${formatSleepDuration(summary.sleep.value.remMinutes)}`
    : undefined;

  const activity = displayMetric(summary.activity, (value) => ({
    value: formatNumber(value.steps),
    unit: 'steps',
  }));
  const activityFacts = summary.activity.status === 'available' ? [
    summary.activity.value.activeDurationMinutes === undefined ? null : `${summary.activity.value.activeDurationMinutes} active min`,
    summary.activity.value.activeEnergyKcal === undefined ? null : `${formatNumber(summary.activity.value.activeEnergyKcal)} kcal`,
    summary.activity.value.workoutCount === undefined ? null : `${summary.activity.value.workoutCount} ${summary.activity.value.workoutCount === 1 ? 'workout' : 'workouts'}`,
  ].filter((value): value is string => value !== null) : [];

  return {
    date: summary.date,
    dateLabel: formatDashboardDate(summary.date, today),
    sleep: { ...sleep, stages: sleepStages, ...(baselines ? baselineCopy(baselines.sleepDuration, 'sleep') : {}) },
    hrv: { ...displayMetric(summary.hrv, (value) => ({ value: String(value.averageRmssdMs), unit: 'ms RMSSD' })), ...(baselines ? baselineCopy(baselines.hrv, 'hrv') : {}) },
    restingHeartRate: { ...displayMetric(summary.heartRate, (value) => value.restingBpm === undefined
      ? { value: tr('common.notReported') }
      : { value: String(value.restingBpm), unit: 'bpm' }), ...(baselines ? baselineCopy(baselines.restingHeartRate, 'rhr') : {}) },
    oxygenSaturation: displayMetric(summary.oxygenSaturation, (value) => ({ value: String(value.averagePercent), unit: '%' })),
    stress: displayMetric(summary.stress, (value) => ({ value: String(value.averageIndex), unit: '/ 100' })),
    activity: { ...activity, facts: activityFacts },
    recovery: recoveryCopy(baselines, recovery),
    insight: insight
      ? { available: true, title: insight.title, detail: insight.explanation }
      : { available: false, title: tr('insights.noChange'), detail: 'Recent patterns have not crossed the conservative insight thresholds.' },
  };
}

export function formatDashboardDate(date: LocalDate, today: LocalDate): string {
  if (date === today) return tr('nav.today');
  if (date === addLocalDays(today, -1)) return tr('state.yesterday');
  return new Intl.DateTimeFormat(getLocale(), { weekday: 'long', month: 'short', day: 'numeric' }).format(parseLocalDate(date));
}

export function formatSyncFreshness(sync: HealthSyncMetadata | null, now: Date): string {
  if (!sync) return tr('state.notSynced');
  if (sync.status === 'running') return tr('state.refreshing');
  if (sync.status === 'failed') return tr('state.refreshFailed');
  if (!sync.lastSuccessfulAt) return tr('state.notSynced');
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - new Date(sync.lastSuccessfulAt).getTime()) / 60_000));
  if (elapsedMinutes < 1) return tr('state.updatedJustNow');
  if (elapsedMinutes < 60) return `Updated ${elapsedMinutes} min ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Updated ${elapsedHours} ${elapsedHours === 1 ? 'hour' : 'hours'} ago`;
  return `Last sync ${new Intl.DateTimeFormat(getLocale(), { month: 'short', day: 'numeric' }).format(new Date(sync.lastSuccessfulAt))}`;
}

export function moveDashboardDate(date: LocalDate, amount: number, firstDate: LocalDate, lastDate: LocalDate): LocalDate {
  const next = addLocalDays(date, amount);
  if (next < firstDate) return firstDate;
  if (next > lastDate) return lastDate;
  return next;
}

export function getEmptyDashboardMessage(storedDays: number): string {
  return storedDays > 0
    ? 'Your local database has earlier health data available.'
    : 'Health data will appear here after your first successful sync.';
}
