import { tr } from '../../localization/i18n';
import type { AppIconName } from '../../components/AppIcon';
import type { LocalDate } from '../../models/health';
import type { TrendMetricId, TrendPoint } from '../../models/trends';
import type { DashboardDayData } from '../../services/DashboardDataService';
import { formatNumber, formatSleepDuration } from '../../shared/formatters/healthFormatters';
import { buildDashboardViewModel, type DashboardViewModel, type MetricDisplay } from '../dashboard/dashboardViewModel';
import type { MetricRoute } from './metricDetailModel';

export function retainSelectedDate(previous: LocalDate | null, points: readonly TrendPoint[], anchor: LocalDate): LocalDate {
  return previous && points.some((point) => point.date === previous) ? previous : anchor;
}
export function trendMetricForDetail(metric: MetricRoute): TrendMetricId | null {
  if (metric === 'recovery') return 'recovery';
  if (metric === 'sleep') return 'sleep-duration';
  if (metric === 'hrv') return 'hrv-rmssd';
  if (metric === 'rhr') return 'resting-heart-rate';
  if (metric === 'activity') return 'steps';
  return null;
}
function displayForMetric(metric: MetricRoute, view: DashboardViewModel): MetricDisplay {
  if (metric === 'sleep') return view.sleep;
  if (metric === 'hrv') return view.hrv;
  if (metric === 'rhr') return view.restingHeartRate;
  if (metric === 'spo2') return view.oxygenSaturation;
  if (metric === 'stress') return view.stress;
  if (metric === 'activity') return view.activity;
  return { status: view.recovery.state === 'ready' || view.recovery.state === 'partial' ? 'available' : 'missing', value: view.recovery.title, detail: view.recovery.detail };
}
export function getSelectedDayPresentation(metric: MetricRoute, day: DashboardDayData) {
  if (!day.summary) return null;
  const view = buildDashboardViewModel(day.summary, day.summary.date, day.baselines ?? undefined, day.recovery ?? undefined, day.insight ?? undefined);
  const display = displayForMetric(metric, view);
  const context = metric === 'recovery' ? view.recovery.detail : display.comparison ?? display.detail ?? (metric === 'spo2' ? tr('detail.averageOxygen') : metric === 'stress' ? tr('detail.averageStress') : metric === 'activity' ? tr('detail.dailyMovement') : display.status === 'available' ? tr('detail.dailySignal') : tr('common.noDayReading'));
  return { view, display, context };
}
export function formatDetailValue(metric: MetricRoute, value?: number, includeUnit = true): string {
  if (value === undefined) return tr('common.noReading');
  if (metric === 'sleep') return formatSleepDuration(Math.round(value));
  const numeric = formatNumber(Math.round(value * 10) / 10);
  if (!includeUnit) return numeric;
  return metric === 'activity' ? tr('format.readingSteps', { amount: numeric }) : `${numeric}${metric === 'spo2' ? '%' : metric === 'recovery' || metric === 'stress' ? ' / 100' : metric === 'hrv' ? ' ms' : ' bpm'}`;
}
interface DetailMeta { label: string; shortLabel: string; accessibilityLabel: string; icon: AppIconName; heroUnit: string; chartUnit: string; detailTitle: string; guide: string }
export function detailMeta(metric: MetricRoute): DetailMeta {
  if (metric === 'recovery') return { label: tr('metric.recovery'), shortLabel: tr('metric.recovery'), accessibilityLabel: tr('metric.recovery'), icon: 'recovery', heroUnit: '/ 100', chartUnit: 'pts', detailTitle: tr('detail.scoreShape'), guide: tr('guide.recovery') };
  if (metric === 'sleep') return { label: tr('metric.sleep'), shortLabel: tr('metric.sleep'), accessibilityLabel: tr('metric.sleepDuration'), icon: 'sleep', heroUnit: '', chartUnit: 'min', detailTitle: tr('detail.insideNight'), guide: tr('guide.sleep') };
  if (metric === 'hrv') return { label: tr('metric.hrv'), shortLabel: tr('metric.hrv'), accessibilityLabel: tr('metric.hrvFull'), icon: 'hrv', heroUnit: 'ms', chartUnit: 'ms', detailTitle: tr('today.reference'), guide: tr('guide.hrv') };
  if (metric === 'rhr') return { label: tr('metric.rhr'), shortLabel: tr('metric.rhrFull').toLowerCase(), accessibilityLabel: tr('metric.rhrFull'), icon: 'heart', heroUnit: 'bpm', chartUnit: 'bpm', detailTitle: tr('detail.restingRhythm'), guide: tr('guide.rhr') };
  if (metric === 'spo2') return { label: tr('metric.spo2'), shortLabel: tr('metric.spo2'), accessibilityLabel: tr('metric.oxygen'), icon: 'oxygen', heroUnit: '%', chartUnit: '%', detailTitle: tr('detail.observationRange'), guide: tr('guide.spo2') };
  if (metric === 'stress') return { label: tr('metric.stress'), shortLabel: tr('metric.stress'), accessibilityLabel: tr('metric.stress'), icon: 'stress', heroUnit: '/ 100', chartUnit: '/100', detailTitle: tr('detail.context'), guide: tr('guide.stress') };
  return { label: tr('metric.activity'), shortLabel: tr('metric.activity'), accessibilityLabel: tr('metric.activityFull'), icon: 'activity', heroUnit: 'steps', chartUnit: 'steps', detailTitle: tr('detail.movement'), guide: tr('guide.activity') };
}
