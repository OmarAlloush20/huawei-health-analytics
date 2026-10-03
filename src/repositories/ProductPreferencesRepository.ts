import type { HealthDatabase } from '../database/types';
import { normalizeLanguage } from '../localization/i18n';
import type { AppLanguage } from '../localization/resources';
import type { TrendMetricId, TrendRangeId } from '../models/trends';

export interface TrendsWorkspace { metric: TrendMetricId; range: TrendRangeId }
export const DEFAULT_TRENDS_WORKSPACE: TrendsWorkspace = { metric: 'recovery', range: '7d' };
const TREND_METRICS: readonly TrendMetricId[] = ['recovery', 'sleep-duration', 'hrv-rmssd', 'resting-heart-rate', 'steps'];
const TREND_RANGES: readonly TrendRangeId[] = ['7d', '30d', '90d'];
export function normalizeTrendsWorkspace(value: unknown): TrendsWorkspace {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_TRENDS_WORKSPACE };
  const candidate = value as Partial<TrendsWorkspace>;
  return {
    metric: candidate.metric && TREND_METRICS.includes(candidate.metric) ? candidate.metric : DEFAULT_TRENDS_WORKSPACE.metric,
    range: candidate.range && TREND_RANGES.includes(candidate.range) ? candidate.range : DEFAULT_TRENDS_WORKSPACE.range,
  };
}

export const FOCUS_METRICS = ['hrv', 'rhr', 'sleep', 'stress', 'spo2', 'activity'] as const;
export type FocusMetric = typeof FOCUS_METRICS[number];
export const MAX_FOCUS_METRICS = 3;

export function normalizeFocusMetrics(value: unknown): FocusMetric[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is FocusMetric => FOCUS_METRICS.includes(item)))].slice(0, MAX_FOCUS_METRICS);
}

export class SQLiteProductPreferencesRepository {
  constructor(private readonly database: HealthDatabase) {}

  async getTrendsWorkspace(): Promise<TrendsWorkspace> {
    const row = await this.database.getFirstAsync<{ value_json: string }>('SELECT value_json FROM product_preferences WHERE preference_key = ?', 'trends_workspace');
    try { return normalizeTrendsWorkspace(row ? JSON.parse(row.value_json) : null); } catch { return { ...DEFAULT_TRENDS_WORKSPACE }; }
  }

  async setTrendsWorkspace(workspace: TrendsWorkspace): Promise<void> {
    await this.database.runAsync('INSERT INTO product_preferences (preference_key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(preference_key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at', 'trends_workspace', JSON.stringify(normalizeTrendsWorkspace(workspace)), new Date().toISOString());
  }

  async getLanguage(): Promise<AppLanguage> {
    const row = await this.database.getFirstAsync<{ value_json: string }>('SELECT value_json FROM product_preferences WHERE preference_key = ?', 'app_language');
    try { return normalizeLanguage(row ? JSON.parse(row.value_json) : null); } catch { return 'en'; }
  }

  async setLanguage(language: AppLanguage): Promise<void> {
    await this.database.runAsync('INSERT INTO product_preferences (preference_key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(preference_key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at', 'app_language', JSON.stringify(normalizeLanguage(language)), new Date().toISOString());
  }

  async getFocusMetrics(): Promise<FocusMetric[]> {
    const row = await this.database.getFirstAsync<{ value_json: string }>('SELECT value_json FROM product_preferences WHERE preference_key = ?', 'today_focus');
    if (!row) return [];
    try { return normalizeFocusMetrics(JSON.parse(row.value_json)); } catch { return []; }
  }

  async setFocusMetrics(metrics: readonly FocusMetric[]): Promise<void> {
    await this.database.runAsync('INSERT INTO product_preferences (preference_key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(preference_key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at', 'today_focus', JSON.stringify(normalizeFocusMetrics(metrics)), new Date().toISOString());
  }
}
