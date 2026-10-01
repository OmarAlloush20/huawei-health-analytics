import type {
  DailyHealthSummary,
  DailyMetricKey,
  DataCompleteness,
  DataProvenance,
  HealthMetric,
} from './health';

export function availableMetric<T>(value: T, provenance: DataProvenance): HealthMetric<T> {
  return { status: 'available', value, provenance };
}

export function missingMetric<T>(reason: string, provenance: DataProvenance): HealthMetric<T> {
  return { status: 'missing', reason, provenance };
}

export function unsupportedMetric<T>(reason: string, provenance: DataProvenance): HealthMetric<T> {
  return { status: 'unsupported', reason, provenance };
}

export function failedMetric<T>(reason: string, provenance: DataProvenance, errorCode?: string): HealthMetric<T> {
  return { status: 'query-failed', reason, errorCode, provenance };
}

const DAILY_KEYS: DailyMetricKey[] = [
  'activity',
  'sleep',
  'heartRate',
  'hrv',
  'oxygenSaturation',
  'stress',
  'activityLoad',
];

export function calculateCompleteness(summary: Omit<DailyHealthSummary, 'completeness'>): DataCompleteness {
  const result: DataCompleteness = {
    available: [],
    missing: [],
    unsupported: [],
    queryFailed: [],
    availableRatio: 0,
  };

  for (const key of DAILY_KEYS) {
    const status = summary[key].status;
    if (status === 'available') result.available.push(key);
    if (status === 'missing') result.missing.push(key);
    if (status === 'unsupported') result.unsupported.push(key);
    if (status === 'query-failed') result.queryFailed.push(key);
  }

  result.availableRatio = result.available.length / DAILY_KEYS.length;
  return result;
}

export function withCompleteness(summary: Omit<DailyHealthSummary, 'completeness'>): DailyHealthSummary {
  return { ...summary, completeness: calculateCompleteness(summary) };
}
