import { DatabaseSync } from 'node:sqlite';

import type { DateRange } from '../models/health';
import { MockHealthProvider } from '../providers/mock/MockHealthProvider';
import { getMockScenarioRange, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../providers/mock/mockHealthData';
import { SQLiteHealthRepository } from '../repositories/SQLiteHealthRepository';
import { HealthSyncService } from '../services/HealthSyncService';
import { DashboardDataService } from '../services/DashboardDataService';
import { BaselineService } from '../services/BaselineService';
import { RecoveryService } from '../services/RecoveryService';
import { TrendsService } from '../services/TrendsService';
import { InsightsService } from '../services/InsightsService';
import { DATABASE_SCHEMA_VERSION, getSchemaVersion, migrateHealthDatabase } from './migrations';
import { resetAndReseedDevelopmentDatabase } from './developmentReset';
import type { HealthDatabase, SqlBindValue, SqlExecutor } from './types';
import { SQLiteNotificationPreferencesRepository } from '../repositories/NotificationPreferencesRepository';
import { SQLiteAppearancePreferencesRepository } from '../repositories/AppearancePreferencesRepository';
import { normalizeFocusMetrics, normalizeTrendsWorkspace, SQLiteProductPreferencesRepository } from '../repositories/ProductPreferencesRepository';

class NodeMemoryDatabase implements HealthDatabase {
  readonly raw = new DatabaseSync(':memory:');

  async execAsync(sql: string) { this.raw.exec(sql); }
  async runAsync(sql: string, ...params: SqlBindValue[]) {
    const result = this.raw.prepare(sql).run(...params);
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }
  async getFirstAsync<T>(sql: string, ...params: SqlBindValue[]) {
    return (this.raw.prepare(sql).get(...params) as T | undefined) ?? null;
  }
  async getAllAsync<T>(sql: string, ...params: SqlBindValue[]) {
    return this.raw.prepare(sql).all(...params) as T[];
  }
  async withExclusiveTransactionAsync(task: (transaction: SqlExecutor) => Promise<void>) {
    this.raw.exec('BEGIN IMMEDIATE');
    try {
      await task(this);
      this.raw.exec('COMMIT');
    } catch (error) {
      this.raw.exec('ROLLBACK');
      throw error;
    }
  }
  close() { this.raw.close(); }
}

const fullRange = getMockScenarioRange('balanced');

describe('SQLite health persistence', () => {
  let database: NodeMemoryDatabase;
  let provider: MockHealthProvider;
  let repository: SQLiteHealthRepository;
  let sync: HealthSyncService;

  beforeEach(async () => {
    database = new NodeMemoryDatabase();
    await migrateHealthDatabase(database);
    provider = new MockHealthProvider({ scenario: 'balanced' });
    repository = new SQLiteHealthRepository(database);
    sync = new HealthSyncService(provider, repository);
  });

  afterEach(() => database.close());

  test('initializes and records a deterministic schema migration once', async () => {
    expect(await getSchemaVersion(database)).toBe(DATABASE_SCHEMA_VERSION);
    await migrateHealthDatabase(database);
    const row = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM schema_migrations');
    expect(row?.count).toBe(4);
    expect(await new SQLiteNotificationPreferencesRepository(database).get()).toMatchObject({
      enabled: false,
      dailyReminderEnabled: true,
      reminderTime: { hour: 9, minute: 0 },
      scheduledReminder: null,
    });
  });

  test('upgrades a Milestone 7 schema without replacing existing health data', async () => {
    const legacy = new NodeMemoryDatabase();
    legacy.raw.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL);
      INSERT INTO schema_migrations VALUES (1, 'initial_normalized_health_schema', '2026-09-30T00:00:00.000Z');
      CREATE TABLE daily_summaries (marker TEXT);
      INSERT INTO daily_summaries VALUES ('preserved');
      PRAGMA user_version = 1;
    `);
    await migrateHealthDatabase(legacy);
    expect(await getSchemaVersion(legacy)).toBe(DATABASE_SCHEMA_VERSION);
    expect(await legacy.getFirstAsync<{ marker: string }>('SELECT marker FROM daily_summaries')).toEqual({ marker: 'preserved' });
    expect(await new SQLiteNotificationPreferencesRepository(legacy).get()).toMatchObject({ enabled: false, dailyReminderEnabled: true });
    legacy.close();
  });

  test('persists language independently of theme/focus and preserves it through health deletion and reseeding', async () => {
    const preferences = new SQLiteProductPreferencesRepository(database);
    expect(await preferences.getLanguage()).toBe('en');
    await preferences.setFocusMetrics(['hrv', 'stress']);
    await preferences.setLanguage('ar');
    expect(await new SQLiteProductPreferencesRepository(database).getLanguage()).toBe('ar');
    expect(await preferences.getFocusMetrics()).toEqual(['hrv', 'stress']);
    expect(await new SQLiteAppearancePreferencesRepository(database).getThemeMode()).toBe('system');
    await sync.deleteAllLocalHealthData();
    expect(await preferences.getLanguage()).toBe('ar');
    await resetAndReseedDevelopmentDatabase(database, sync, fullRange);
    expect(await new SQLiteProductPreferencesRepository(database).getLanguage()).toBe('ar');
    await preferences.setLanguage('en');
    expect(await preferences.getLanguage()).toBe('en');
    for (const value of ['"fr"', 'null', '{invalid']) {
      await database.runAsync('UPDATE product_preferences SET value_json = ? WHERE preference_key = ?', value, 'app_language');
      expect(await preferences.getLanguage()).toBe('en');
    }
  });

  test('persists the app theme preference and defaults to System', async () => {
    const appearance = new SQLiteAppearancePreferencesRepository(database);
    expect(await appearance.getThemeMode()).toBe('system');
    await appearance.setThemeMode('dark', '2026-10-02T10:00:00.000Z');
    expect(await appearance.getThemeMode()).toBe('dark');
    await appearance.setThemeMode('light', '2026-10-02T10:01:00.000Z');
    expect(await appearance.getThemeMode()).toBe('light');
    await sync.deleteAllLocalHealthData();
    await resetAndReseedDevelopmentDatabase(database, sync, fullRange);
    expect(await new SQLiteAppearancePreferencesRepository(database).getThemeMode()).toBe('light');
  });

  test('remembers only a valid Trends metric/range independently of health deletion, reset, language and focus', async () => {
    const preferences = new SQLiteProductPreferencesRepository(database);
    expect(await preferences.getTrendsWorkspace()).toEqual({ metric: 'recovery', range: '7d' });
    await preferences.setLanguage('ar');
    await preferences.setFocusMetrics(['hrv', 'rhr']);
    await preferences.setTrendsWorkspace({ metric: 'hrv-rmssd', range: '30d' });
    const reopened = new SQLiteProductPreferencesRepository(database);
    expect(await reopened.getTrendsWorkspace()).toEqual({ metric: 'hrv-rmssd', range: '30d' });
    await sync.deleteAllLocalHealthData();
    await resetAndReseedDevelopmentDatabase(database, sync, fullRange);
    expect(await reopened.getTrendsWorkspace()).toEqual({ metric: 'hrv-rmssd', range: '30d' });
    expect(await reopened.getLanguage()).toBe('ar');
    expect(await reopened.getFocusMetrics()).toEqual(['hrv', 'rhr']);
    for (const value of ['null', '[]', '{invalid', '{"metric":"stress","range":"1d"}']) {
      await database.runAsync('UPDATE product_preferences SET value_json = ? WHERE preference_key = ?', value, 'trends_workspace');
      expect(await preferences.getTrendsWorkspace()).toEqual({ metric: 'recovery', range: '7d' });
    }
    expect(normalizeTrendsWorkspace({ metric: 'steps', range: 'invalid', selectedDate: '2026-09-28', compareMetric: 'recovery' })).toEqual({ metric: 'steps', range: '7d' });
    expect(normalizeTrendsWorkspace({ metric: 'invalid', range: '90d' })).toEqual({ metric: 'recovery', range: '90d' });
    const unsafe = { metric: 'steps', range: '90d', selectedDate: '2026-09-28', compareMetric: 'recovery' };
    await preferences.setTrendsWorkspace(unsafe as Parameters<typeof preferences.setTrendsWorkspace>[0]);
    const row = await database.getFirstAsync<{ value_json: string }>('SELECT value_json FROM product_preferences WHERE preference_key = ?', 'trends_workspace');
    expect(JSON.parse(row!.value_json)).toEqual({ metric: 'steps', range: '90d' });
  });

  test('persists chosen Today readings across repository creation, health deletion and development reseeding', async () => {
    const preferences = new SQLiteProductPreferencesRepository(database);
    expect(await preferences.getFocusMetrics()).toEqual([]);
    await preferences.setFocusMetrics(['stress', 'hrv', 'sleep']);
    expect(await new SQLiteProductPreferencesRepository(database).getFocusMetrics()).toEqual(['stress', 'hrv', 'sleep']);
    await sync.deleteAllLocalHealthData();
    expect(await preferences.getFocusMetrics()).toEqual(['stress', 'hrv', 'sleep']);
    await resetAndReseedDevelopmentDatabase(database, sync, fullRange);
    expect(await preferences.getFocusMetrics()).toEqual(['stress', 'hrv', 'sleep']);
    expect(normalizeFocusMetrics(['hrv', 'recovery', 'hrv', 'rhr', 'sleep', 'stress'])).toEqual(['hrv', 'rhr', 'sleep']);
    expect(normalizeFocusMetrics('broken')).toEqual([]);
  });

  test('persists notification preferences and scheduler metadata in the singleton row', async () => {
    const notifications = new SQLiteNotificationPreferencesRepository(database);
    await notifications.setEnabled(true, '2026-10-01T08:00:00.000Z');
    await notifications.setDailyReminderEnabled(false, '2026-10-01T08:01:00.000Z');
    await notifications.setReminderTime(19, 45, '2026-10-01T08:02:00.000Z');
    await notifications.setScheduledReminder({ id: 'native-id', hour: 19, minute: 45 }, '2026-10-01T08:03:00.000Z');
    expect(await notifications.get()).toEqual({
      enabled: true,
      dailyReminderEnabled: false,
      reminderTime: { hour: 19, minute: 45 },
      scheduledReminder: { id: 'native-id', hour: 19, minute: 45 },
      updatedAt: '2026-10-01T08:03:00.000Z',
    });
  });

  test('imports and reconstructs normalized daily and range data', async () => {
    const persisted = await sync.sync(fullRange);
    const stats = await sync.getStats();
    expect(stats).toMatchObject({ storedDays: 90, firstDate: fullRange.start, lastDate: fullRange.end, schemaVersion: DATABASE_SCHEMA_VERSION });
    expect(persisted.dailySummaries.status).toBe('available');

    const expected = await provider.getDailySummary({ date: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
    const actual = await repository.getDailySummary('mock', { date: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
    expect(actual).toEqual(expected);
    expect(actual?.stress).toEqual(expected?.stress);
    expect(await repository.getDailySummaries('mock', { start: '2026-09-24', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE })).toHaveLength(7);
  });

  test('reconstructs a legacy daily payload without Stress as explicitly unsupported', async () => {
    const summary = await provider.getDailySummary({ date: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
    if (!summary) throw new Error('Expected a mock summary');
    const legacy = JSON.parse(JSON.stringify(summary)) as Record<string, unknown>;
    delete legacy.stress;
    await database.runAsync(
      'INSERT INTO daily_summaries (provider, local_date, time_zone, payload_json, synced_at) VALUES (?, ?, ?, ?, ?)',
      'mock', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, JSON.stringify(legacy), '2026-09-30T12:00:00.000Z',
    );

    const reconstructed = await repository.getDailySummary('mock', { date: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
    expect(reconstructed?.stress).toMatchObject({ status: 'unsupported' });
    expect(reconstructed?.completeness.unsupported).toContain('stress');
  });

  test('bootstraps the development Dashboard through the normal sync pipeline only when empty', async () => {
    const baseline = new BaselineService('mock', repository);
    const trends = new TrendsService('mock', repository);
    const dashboard = new DashboardDataService(provider, database, repository, sync, new RecoveryService(baseline), new InsightsService(trends));
    const initial = await dashboard.getStats();
    expect(initial.storedDays).toBe(0);
    const seeded = await dashboard.bootstrapDevelopmentDataIfEmpty(initial);
    expect(seeded.storedDays).toBe(90);
    const day = await dashboard.readDay(MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
    expect(day.summary).not.toBeNull();
    expect(day.baselines?.hrv).toMatchObject({ status: 'ready', historyEndDate: '2026-09-29' });
    expect(day.recovery).toMatchObject({ status: 'ready', completeness: 'complete', score: expect.any(Number) });
    expect((await dashboard.bootstrapDevelopmentDataIfEmpty(seeded)).storedDays).toBe(90);
  });

  test('switches development scenarios by resetting and reseeding persisted data', async () => {
    const baseline = new BaselineService('mock', repository);
    const trends = new TrendsService('mock', repository);
    const dashboard = new DashboardDataService(provider, database, repository, sync, new RecoveryService(baseline), new InsightsService(trends));
    await dashboard.bootstrapDevelopmentDataIfEmpty(await dashboard.getStats());
    const switched = await dashboard.selectDevelopmentScenario('insufficient-history');
    expect(switched.storedDays).toBe(7);
    expect(dashboard.getDevelopmentScenarios()?.current).toBe('insufficient-history');
    const day = await dashboard.readDay(MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
    expect(day.summary?.source).toBe('mock');
    expect(day.baselines?.sleepDuration).toMatchObject({ status: 'learning', validSampleCount: 6 });
    expect(day.recovery?.status).toBe('learning');
    expect(day.recovery?.score).toBeUndefined();
  });

  test('exposes all six deterministic scenarios with descriptive UI-state copy', () => {
    const baseline = new BaselineService('mock', repository);
    const trends = new TrendsService('mock', repository);
    const dashboard = new DashboardDataService(provider, database, repository, sync, new RecoveryService(baseline), new InsightsService(trends));
    const state = dashboard.getDevelopmentScenarios();
    expect(state?.current).toBe('balanced');
    expect(state?.options.map((option) => option.id)).toEqual([
      'balanced',
      'poor-sleep',
      'low-hrv-elevated-rhr',
      'high-activity',
      'insufficient-history',
      'missing-data',
    ]);
    expect(state?.options.every((option) => option.description.length > 30)).toBe(true);
  });

  test('repeated sync is idempotent for every stable entity', async () => {
    await sync.sync(fullRange);
    const before = await entityCounts(database);
    await sync.sync(fullRange);
    expect(await entityCounts(database)).toEqual(before);
    expect((await sync.getStats()).storedDays).toBe(90);
  });

  test('round-trips missing, query-failed, and unsupported states', async () => {
    provider.setScenario('missing-data');
    const range: DateRange = { start: '2026-09-24', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE };
    await sync.sync(range);
    const result = await sync.read(range);
    if (result.dailySummaries.status !== 'available') throw new Error('Expected summaries');
    expect(result.dailySummaries.value.some((day) => day.sleep.status === 'missing')).toBe(true);
    expect(result.dailySummaries.value.some((day) => day.heartRate.status === 'query-failed')).toBe(true);
    expect(result.dailySummaries.value.every((day) => day.activityLoad.status === 'unsupported')).toBe(true);
  });

  test('persists sleep stages and workouts without duplication', async () => {
    const expected = await provider.getHealthData(fullRange);
    const actual = await sync.sync(fullRange);
    expect(actual.sleepSessions).toEqual(expected.sleepSessions);
    expect(actual.workouts).toEqual(expected.workouts);
    const stageCount = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sleep_stages');
    expect(stageCount?.count).toBe(90 * 4);
  });

  test('replacing a provider range removes stale scenario records', async () => {
    await sync.sync(fullRange);
    provider.setScenario('missing-data');
    await sync.sync(fullRange);
    const result = await sync.read(fullRange);
    if (result.dailySummaries.status !== 'available') throw new Error('Expected summaries');
    expect(result.dailySummaries.value).toHaveLength(90);
    expect(result.dailySummaries.value.some((day) => day.sleep.status === 'missing')).toBe(true);
    expect((await entityCounts(database)).daily_summaries).toBe(90);
  });

  test('retention deletes old detailed rows but preserves all daily summaries', async () => {
    await sync.sync(fullRange);
    const removed = await repository.applyRetention({ detailedDataDays: 30 }, MOCK_ANCHOR_DATE);
    expect(removed).toBeGreaterThan(0);
    expect((await sync.getStats()).storedDays).toBe(90);
    const oldest = await database.getFirstAsync<{ oldest: string | null }>('SELECT MIN(local_date) AS oldest FROM heart_rate_samples');
    expect(oldest?.oldest).toBe('2026-09-01');
    expect((await sync.read({ start: '2026-07-03', end: '2026-07-03', timeZone: MOCK_TIME_ZONE })).heartRateSamples.status).toBe('missing');
    expect((await sync.read({ start: '2026-09-01', end: '2026-09-30', timeZone: MOCK_TIME_ZONE })).heartRateSamples.status).toBe('available');
  });

  test('detailed deletion retains daily summaries and sync metadata', async () => {
    await sync.sync(fullRange);
    expect(await sync.deleteDetailedData()).toBeGreaterThan(0);
    expect((await sync.getStats()).storedDays).toBe(90);
    expect((await sync.getStats()).sync?.status).toBe('succeeded');
    const counts = await entityCounts(database);
    expect(counts.heart_rate_samples).toBe(0);
    expect(counts.sleep_sessions).toBe(0);
    expect((await sync.read(fullRange)).heartRateSamples.status).toBe('missing');
  });

  test('full local deletion removes health records and sync metadata', async () => {
    await sync.sync(fullRange);
    expect(await sync.deleteAllLocalHealthData()).toBeGreaterThan(0);
    expect((await sync.getStats()).storedDays).toBe(0);
    expect((await sync.getStats()).sync).toBeNull();
  });

  test('development reset drops, remigrates, and reseeds safely', async () => {
    await sync.sync(fullRange);
    await resetAndReseedDevelopmentDatabase(database, sync, fullRange);
    expect(await getSchemaVersion(database)).toBe(DATABASE_SCHEMA_VERSION);
    expect((await sync.getStats()).storedDays).toBe(90);
    const migrations = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM schema_migrations');
    expect(migrations?.count).toBe(DATABASE_SCHEMA_VERSION);
  });

  test('records sync failures without erasing the last successful timestamp', async () => {
    await sync.sync(fullRange);
    const successfulAt = (await sync.getStats()).sync?.lastSuccessfulAt;
    jest.spyOn(provider, 'getHealthData').mockRejectedValueOnce(new Error('simulated failure'));
    await expect(sync.sync(fullRange)).rejects.toThrow('simulated failure');
    expect((await sync.getStats()).sync).toMatchObject({ status: 'failed', error: 'simulated failure', lastSuccessfulAt: successfulAt });
  });
});

async function entityCounts(database: NodeMemoryDatabase) {
  const tables = ['daily_summaries', 'sleep_sessions', 'sleep_stages', 'heart_rate_samples', 'hrv_observations', 'oxygen_saturation_samples', 'workouts'] as const;
  const result: Record<(typeof tables)[number], number> = {} as Record<(typeof tables)[number], number>;
  for (const table of tables) {
    const row = await database.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
    result[table] = row?.count ?? 0;
  }
  return result;
}
