import type { BaselineMetricId, BaselineResult, DailyBaselineSet } from '../models/baseline';
import type {
  RecoveryCategory,
  RecoveryResult,
  RecoverySignalContribution,
  RecoverySignalStatus,
} from '../models/recovery';

export const RECOVERY_ENGINE_CONFIG = {
  version: 1,
  neutralSignalScore: 75,
  maximumFavorableScore: 90,
  minimumSignalScore: 0,
  adversePenaltyPerRangeWidth: 50,
  favorableBonusPerRangeWidth: 15,
  maximumAdverseWidths: 1.5,
  maximumFavorableWidths: 1,
  minimumUsableSignals: 2,
  weights: {
    'hrv-rmssd': 0.4,
    'resting-heart-rate': 0.35,
    'sleep-duration': 0.25,
  },
  categories: {
    fairMinimum: 40,
    goodMinimum: 60,
    highMinimum: 80,
  },
} as const;

type Direction = 'higher-is-favorable' | 'lower-is-favorable';

interface SignalDefinition {
  signal: BaselineMetricId;
  direction: Direction;
  label: string;
}

const SIGNALS: readonly SignalDefinition[] = [
  { signal: 'hrv-rmssd', direction: 'higher-is-favorable', label: 'HRV' },
  { signal: 'resting-heart-rate', direction: 'lower-is-favorable', label: 'Resting heart rate' },
  { signal: 'sleep-duration', direction: 'higher-is-favorable', label: 'Sleep duration' },
] as const;

const round = (value: number, decimals = 1): number => Math.round(value * 10 ** decimals) / 10 ** decimals;
const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value));

function baselineFor(set: DailyBaselineSet, signal: BaselineMetricId): BaselineResult {
  if (signal === 'hrv-rmssd') return set.hrv;
  if (signal === 'resting-heart-rate') return set.restingHeartRate;
  return set.sleepDuration;
}

function unavailableStatus(result: BaselineResult): RecoverySignalStatus | null {
  if (result.status === 'learning' || result.status === 'insufficient-data') return 'baseline-learning';
  if (result.status === 'unavailable') return 'baseline-unavailable';
  if (result.currentStatus !== 'available' || result.currentValue === undefined) return 'today-unavailable';
  return null;
}

function valuesAreValid(result: BaselineResult): boolean {
  const values = [result.currentValue, result.center, result.lowerBound, result.upperBound];
  if (values.some((value) => value === undefined || !Number.isFinite(value))) return false;
  if (!result.relation) return false;
  if (result.lowerBound! > result.center! || result.center! > result.upperBound!) return false;
  if (result.metric === 'sleep-duration') return values.every((value) => value! >= 0) && result.center! > 0;
  return values.every((value) => value! > 0);
}

function reasonFor(definition: SignalDefinition, relation?: BaselineResult['relation']): string {
  if (relation === 'within-range') return `${definition.label} was within your recent range.`;
  if (definition.signal === 'sleep-duration') {
    return relation === 'below-range'
      ? 'Sleep was shorter than your recent range.'
      : 'Sleep was longer than your recent range.';
  }
  return `${definition.label} was ${relation === 'below-range' ? 'below' : 'above'} your recent range.`;
}

function unavailableReason(definition: SignalDefinition, status: RecoverySignalStatus): string {
  if (status === 'baseline-learning') return `${definition.label} baseline is still learning.`;
  if (status === 'baseline-unavailable') return `${definition.label} baseline is unavailable from this source.`;
  if (status === 'today-unavailable') return `${definition.label} is unavailable today.`;
  return `${definition.label} contained invalid values and was excluded.`;
}

function scoreSignal(result: BaselineResult, direction: Direction): number {
  if (result.relation === 'within-range') return RECOVERY_ENGINE_CONFIG.neutralSignalScore;
  const adverse = direction === 'higher-is-favorable'
    ? result.relation === 'below-range'
    : result.relation === 'above-range';
  const boundary = adverse
    ? direction === 'higher-is-favorable' ? result.lowerBound! : result.upperBound!
    : direction === 'higher-is-favorable' ? result.upperBound! : result.lowerBound!;
  const rangeWidth = adverse
    ? direction === 'higher-is-favorable' ? result.center! - result.lowerBound! : result.upperBound! - result.center!
    : direction === 'higher-is-favorable' ? result.upperBound! - result.center! : result.center! - result.lowerBound!;
  const safeWidth = Math.max(Math.abs(rangeWidth), Math.abs(result.center!) * 0.05, 1);
  const widthsOutside = Math.abs(result.currentValue! - boundary) / safeWidth;
  if (adverse) {
    const penalty = RECOVERY_ENGINE_CONFIG.adversePenaltyPerRangeWidth
      * Math.min(widthsOutside, RECOVERY_ENGINE_CONFIG.maximumAdverseWidths);
    return round(clamp(RECOVERY_ENGINE_CONFIG.neutralSignalScore - penalty, RECOVERY_ENGINE_CONFIG.minimumSignalScore, 100));
  }
  const bonus = RECOVERY_ENGINE_CONFIG.favorableBonusPerRangeWidth
    * Math.min(widthsOutside, RECOVERY_ENGINE_CONFIG.maximumFavorableWidths);
  return round(clamp(RECOVERY_ENGINE_CONFIG.neutralSignalScore + bonus, 0, RECOVERY_ENGINE_CONFIG.maximumFavorableScore));
}

function initialContribution(definition: SignalDefinition, result: BaselineResult): RecoverySignalContribution {
  const configuredWeight = RECOVERY_ENGINE_CONFIG.weights[definition.signal];
  const unavailable = unavailableStatus(result);
  const status = unavailable ?? (valuesAreValid(result) ? 'used' : 'invalid');
  const base = {
    signal: definition.signal,
    status,
    configuredWeight,
    baselineStatus: result.status,
    currentStatus: result.currentStatus,
    unit: result.unit,
    currentValue: result.currentValue,
    baselineCenter: result.center,
    lowerBound: result.lowerBound,
    upperBound: result.upperBound,
    absoluteDifference: result.absoluteDifference,
    relativeDifferencePercent: result.relativeDifferencePercent,
    relation: result.relation,
  };
  if (status !== 'used') return { ...base, reason: unavailableReason(definition, status) };
  return { ...base, signalScore: scoreSignal(result, definition.direction), reason: reasonFor(definition, result.relation) };
}

export function recoveryCategory(score: number): RecoveryCategory {
  if (score >= RECOVERY_ENGINE_CONFIG.categories.highMinimum) return 'high';
  if (score >= RECOVERY_ENGINE_CONFIG.categories.goodMinimum) return 'good';
  if (score >= RECOVERY_ENGINE_CONFIG.categories.fairMinimum) return 'fair';
  return 'low';
}

function explanationFor(contributions: readonly RecoverySignalContribution[], enoughSignals: boolean, learning: boolean): string {
  if (!enoughSignals) {
    return learning
      ? 'Recovery will appear after enough personal baselines are ready.'
      : 'Recovery is unavailable because fewer than two signals can be evaluated today.';
  }
  const used = contributions.filter((item) => item.status === 'used');
  const adverse = used.filter((item) => (item.impactFromNeutral ?? 0) < 0).sort((a, b) => a.impactFromNeutral! - b.impactFromNeutral!);
  if (adverse.length) return adverse.slice(0, 2).map((item) => item.reason).join(' ');
  const favorable = used.filter((item) => (item.impactFromNeutral ?? 0) > 0);
  if (favorable.length) return `${favorable[0].reason} Other available signals stayed within or above their recent pattern.`;
  return 'Available recovery signals were within their recent personal ranges.';
}

export function calculateRecovery(baselines: DailyBaselineSet): RecoveryResult {
  const initial = SIGNALS.map((definition) => initialContribution(definition, baselineFor(baselines, definition.signal)));
  const used = initial.filter((item) => item.status === 'used');
  const usableWeight = used.reduce((sum, item) => sum + item.configuredWeight, 0);
  const contributions = initial.map((item) => {
    if (item.status !== 'used') return item;
    const normalizedWeight = item.configuredWeight / usableWeight;
    const weightedPoints = item.signalScore! * normalizedWeight;
    return {
      ...item,
      normalizedWeight: round(normalizedWeight, 4),
      weightedPoints: round(weightedPoints, 2),
      impactFromNeutral: round((item.signalScore! - RECOVERY_ENGINE_CONFIG.neutralSignalScore) * normalizedWeight, 2),
    };
  });
  const enoughSignals = used.length >= RECOVERY_ENGINE_CONFIG.minimumUsableSignals;
  const learning = initial.some((item) => item.status === 'baseline-learning');
  const completenessPercent = Math.round(usableWeight * 100);
  if (!enoughSignals) {
    return {
      version: RECOVERY_ENGINE_CONFIG.version,
      evaluatedDate: baselines.evaluatedDate,
      timeZone: baselines.timeZone,
      status: learning ? 'learning' : 'unavailable',
      completeness: 'insufficient',
      completenessPercent,
      usableSignalCount: used.length,
      requiredSignalCount: RECOVERY_ENGINE_CONFIG.minimumUsableSignals,
      explanation: explanationFor(contributions, false, learning),
      contributions,
    };
  }
  const score = Math.round(contributions.reduce((sum, item) => sum + (item.weightedPoints ?? 0), 0));
  const complete = used.length === SIGNALS.length;
  return {
    version: RECOVERY_ENGINE_CONFIG.version,
    evaluatedDate: baselines.evaluatedDate,
    timeZone: baselines.timeZone,
    status: complete ? 'ready' : 'partial',
    completeness: complete ? 'complete' : 'partial',
    completenessPercent,
    usableSignalCount: used.length,
    requiredSignalCount: RECOVERY_ENGINE_CONFIG.minimumUsableSignals,
    score: clamp(score, 0, 100),
    category: recoveryCategory(score),
    explanation: explanationFor(contributions, true, learning),
    contributions,
  };
}
