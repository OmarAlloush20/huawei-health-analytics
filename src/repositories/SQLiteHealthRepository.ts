import type {
  DailyHealthSummary,
  DateRange,
  HealthDayQuery,
  HealthMetric,
  HealthMetricSource,
  HeartRateSample,
  HrvObservation,
  NormalizedHealthData,
  OxygenSaturationSample,
  SleepSession,
  SleepStage,
  WorkoutSession,
} from '../models/health';
import { availableMetric, missingMetric, unsupportedMetric, withCompleteness } from '../models/healthMetrics';
import { addLocalDays, toLocalDate } from '../shared/dates/healthDates';
import { getSchemaVersion } from '../database/migrations';
import type {
  HealthDatabase,
  HealthSyncMetadata,
  RetentionPolicy,
  SqlExecutor,
  StoredHealthStats,
} from '../database/types';

interface JsonRow { payload_json: string }
interface ImportRangeRow { collection_states_json: string }
interface CountRow { count: number; first_date: string | null; last_date: string | null }
interface SyncRow {
  provider: HealthMetricSource;
  status: HealthSyncMetadata['status'];
  last_attempted_at: string;
  last_successful_at: string | null;
  start_date: string | null;
  end_date: string | null;
  time_zone: string | null;
  error: string | null;
}

type DetailedCollectionKey = 'sleepSessions' | 'heartRateSamples' | 'hrvObservations' | 'oxygenSaturationSamples' | 'workouts';
type CollectionStates = Record<DetailedCollectionKey, Omit<HealthMetric<unknown[]>, 'value'>>;

export interface PersistedHealthRepository {
  replaceProviderData(provider: HealthMetricSource, data: NormalizedHealthData, syncedAt: string): Promise<void>;
  getDailySummary(provider: HealthMetricSource, query: HealthDayQuery): Promise<DailyHealthSummary | null>;
  getDailySummaries(provider: HealthMetricSource, range: DateRange): Promise<DailyHealthSummary[]>;
  getHealthData(provider: HealthMetricSource, range: DateRange): Promise<NormalizedHealthData>;
  recordSyncAttempt(provider: HealthMetricSource, range: DateRange, attemptedAt: string): Promise<void>;
  recordSyncFailure(provider: HealthMetricSource, range: DateRange, attemptedAt: string, error: string): Promise<void>;
  getSyncMetadata(provider: HealthMetricSource): Promise<HealthSyncMetadata | null>;
  getStats(provider: HealthMetricSource): Promise<StoredHealthStats>;
  applyRetention(policy: RetentionPolicy, asOfDate: string): Promise<number>;
  deleteDetailedHealthData(provider?: HealthMetricSource): Promise<number>;
  deleteAllLocalHealthData(): Promise<number>;
}

const parseJson = <T>(value: string): T => JSON.parse(value) as T;
const stringify = (value: unknown) => JSON.stringify(value);

type LegacyDailyHealthSummary = Omit<DailyHealthSummary, 'stress'> & { stress?: DailyHealthSummary['stress'] };

function parseDailySummary(value: string): DailyHealthSummary {
  const summary = parseJson<LegacyDailyHealthSummary>(value);
  if (summary.stress) return summary as DailyHealthSummary;
  const { completeness, ...legacy } = summary;
  void completeness;
  return withCompleteness({
    ...legacy,
    stress: unsupportedMetric('Stress was not stored in this legacy daily summary.', summary.activity.provenance),
  });
}

function collectionState<T>(metric: HealthMetric<T[]>): Omit<HealthMetric<unknown[]>, 'value'> {
  if (metric.status === 'available') return { status: 'available', provenance: metric.provenance };
  return metric;
}

function stableKey(timestamp: string, context: string, sourceId?: string): string {
  return `${sourceId ?? 'unknown'}|${timestamp}|${context}`;
}

async function insertDaily(transaction: SqlExecutor, summary: DailyHealthSummary): Promise<void> {
  const syncTimes = [summary.activity, summary.sleep, summary.heartRate, summary.hrv, summary.oxygenSaturation, summary.stress]
    .map((metric) => metric.provenance.syncedAt)
    .sort();
  await transaction.runAsync(
    `INSERT INTO daily_summaries (provider, local_date, time_zone, payload_json, synced_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(provider, local_date, time_zone) DO UPDATE SET payload_json=excluded.payload_json, synced_at=excluded.synced_at`,
    summary.source,
    summary.date,
    summary.timeZone,
    stringify(summary),
    syncTimes.at(-1) ?? new Date().toISOString(),
  );
}

export class SQLiteHealthRepository implements PersistedHealthRepository {
  constructor(private readonly database: HealthDatabase) {}

  async replaceProviderData(provider: HealthMetricSource, data: NormalizedHealthData, syncedAt: string): Promise<void> {
    const summaries = data.dailySummaries.status === 'available' ? data.dailySummaries.value : [];
    if (summaries.some((summary) => summary.source !== provider)) {
      throw new Error(`Cannot persist ${provider} data containing a summary from another provider.`);
    }
    const collections: CollectionStates = {
      sleepSessions: collectionState(data.sleepSessions),
      heartRateSamples: collectionState(data.heartRateSamples),
      hrvObservations: collectionState(data.hrvObservations),
      oxygenSaturationSamples: collectionState(data.oxygenSaturationSamples),
      workouts: collectionState(data.workouts),
    };

    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      for (const table of ['daily_summaries', 'sleep_sessions', 'heart_rate_samples', 'hrv_observations', 'oxygen_saturation_samples', 'workouts']) {
        await transaction.runAsync(`DELETE FROM ${table} WHERE provider = ? AND local_date BETWEEN ? AND ?`, provider, data.range.start, data.range.end);
      }
      await transaction.runAsync(
        `DELETE FROM import_ranges WHERE provider = ? AND NOT (end_date < ? OR start_date > ?)`,
        provider,
        data.range.start,
        data.range.end,
      );

      for (const summary of summaries) await insertDaily(transaction, summary);

      if (data.sleepSessions.status === 'available') {
        for (const session of data.sleepSessions.value) {
          const { stages, ...sessionWithoutStages } = session;
          await transaction.runAsync(
            `INSERT INTO sleep_sessions (provider, session_id, local_date, start_time, end_time, payload_json) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(provider, session_id) DO UPDATE SET local_date=excluded.local_date, start_time=excluded.start_time, end_time=excluded.end_time, payload_json=excluded.payload_json`,
            provider, session.id, session.date, session.startTime, session.endTime, stringify(sessionWithoutStages),
          );
          await transaction.runAsync('DELETE FROM sleep_stages WHERE provider = ? AND session_id = ?', provider, session.id);
          for (const [index, stage] of stages.entries()) {
            await transaction.runAsync(
              'INSERT INTO sleep_stages (provider, session_id, stage_index, stage, start_time, end_time, duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)',
              provider, session.id, index, stage.stage, stage.startTime, stage.endTime, stage.durationMinutes,
            );
          }
        }
      }

      if (data.heartRateSamples.status === 'available') for (const sample of data.heartRateSamples.value) {
        await transaction.runAsync(
          `INSERT INTO heart_rate_samples (provider, sample_key, local_date, timestamp, payload_json) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(provider, sample_key) DO UPDATE SET local_date=excluded.local_date, timestamp=excluded.timestamp, payload_json=excluded.payload_json`,
          provider, stableKey(sample.timestamp, sample.context, sample.provenance.sourceId), toLocalDate(new Date(sample.timestamp), data.range.timeZone), sample.timestamp, stringify(sample),
        );
      }
      if (data.hrvObservations.status === 'available') for (const observation of data.hrvObservations.value) {
        await transaction.runAsync(
          `INSERT INTO hrv_observations (provider, observation_key, local_date, timestamp, payload_json) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(provider, observation_key) DO UPDATE SET local_date=excluded.local_date, timestamp=excluded.timestamp, payload_json=excluded.payload_json`,
          provider, stableKey(observation.timestamp, observation.context, observation.provenance.sourceId), toLocalDate(new Date(observation.timestamp), data.range.timeZone), observation.timestamp, stringify(observation),
        );
      }
      if (data.oxygenSaturationSamples.status === 'available') for (const sample of data.oxygenSaturationSamples.value) {
        await transaction.runAsync(
          `INSERT INTO oxygen_saturation_samples (provider, sample_key, local_date, timestamp, payload_json) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(provider, sample_key) DO UPDATE SET local_date=excluded.local_date, timestamp=excluded.timestamp, payload_json=excluded.payload_json`,
          provider, stableKey(sample.timestamp, sample.context, sample.provenance.sourceId), toLocalDate(new Date(sample.timestamp), data.range.timeZone), sample.timestamp, stringify(sample),
        );
      }
      if (data.workouts.status === 'available') for (const workout of data.workouts.value) {
        await transaction.runAsync(
          `INSERT INTO workouts (provider, workout_id, local_date, start_time, end_time, payload_json) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(provider, workout_id) DO UPDATE SET local_date=excluded.local_date, start_time=excluded.start_time, end_time=excluded.end_time, payload_json=excluded.payload_json`,
          provider, workout.id, workout.date, workout.startTime, workout.endTime, stringify(workout),
        );
      }

      await transaction.runAsync(
        'INSERT INTO import_ranges (provider, start_date, end_date, time_zone, collection_states_json, imported_at) VALUES (?, ?, ?, ?, ?, ?)',
        provider, data.range.start, data.range.end, data.range.timeZone, stringify(collections), syncedAt,
      );
      await transaction.runAsync(
        `INSERT INTO sync_metadata (provider, status, last_attempted_at, last_successful_at, start_date, end_date, time_zone, error)
         VALUES (?, 'succeeded', ?, ?, ?, ?, ?, NULL)
         ON CONFLICT(provider) DO UPDATE SET status='succeeded', last_attempted_at=excluded.last_attempted_at, last_successful_at=excluded.last_successful_at, start_date=excluded.start_date, end_date=excluded.end_date, time_zone=excluded.time_zone, error=NULL`,
        provider, syncedAt, syncedAt, data.range.start, data.range.end, data.range.timeZone,
      );
    });
  }

  async getDailySummary(provider: HealthMetricSource, query: HealthDayQuery): Promise<DailyHealthSummary | null> {
    const row = await this.database.getFirstAsync<JsonRow>(
      'SELECT payload_json FROM daily_summaries WHERE provider = ? AND local_date = ? AND time_zone = ?',
      provider, query.date, query.timeZone,
    );
    return row ? parseDailySummary(row.payload_json) : null;
  }

  async getDailySummaries(provider: HealthMetricSource, range: DateRange): Promise<DailyHealthSummary[]> {
    const rows = await this.database.getAllAsync<JsonRow>(
      'SELECT payload_json FROM daily_summaries WHERE provider = ? AND time_zone = ? AND local_date BETWEEN ? AND ? ORDER BY local_date',
      provider, range.timeZone, range.start, range.end,
    );
    return rows.map((row) => parseDailySummary(row.payload_json));
  }

  async getHealthData(provider: HealthMetricSource, range: DateRange): Promise<NormalizedHealthData> {
    const [summaries, sleepRows, heartRows, hrvRows, spo2Rows, workoutRows, importRow] = await Promise.all([
      this.getDailySummaries(provider, range),
      this.database.getAllAsync<JsonRow>('SELECT payload_json FROM sleep_sessions WHERE provider = ? AND local_date BETWEEN ? AND ? ORDER BY start_time', provider, range.start, range.end),
      this.database.getAllAsync<JsonRow>('SELECT payload_json FROM heart_rate_samples WHERE provider = ? AND local_date BETWEEN ? AND ? ORDER BY timestamp', provider, range.start, range.end),
      this.database.getAllAsync<JsonRow>('SELECT payload_json FROM hrv_observations WHERE provider = ? AND local_date BETWEEN ? AND ? ORDER BY timestamp', provider, range.start, range.end),
      this.database.getAllAsync<JsonRow>('SELECT payload_json FROM oxygen_saturation_samples WHERE provider = ? AND local_date BETWEEN ? AND ? ORDER BY timestamp', provider, range.start, range.end),
      this.database.getAllAsync<JsonRow>('SELECT payload_json FROM workouts WHERE provider = ? AND local_date BETWEEN ? AND ? ORDER BY start_time', provider, range.start, range.end),
      this.database.getFirstAsync<ImportRangeRow>(
        'SELECT collection_states_json FROM import_ranges WHERE provider = ? AND time_zone = ? AND start_date <= ? AND end_date >= ? ORDER BY imported_at DESC LIMIT 1',
        provider, range.timeZone, range.start, range.end,
      ),
    ]);

    const sessions = await Promise.all(sleepRows.map(async (row) => {
      const session = parseJson<Omit<SleepSession, 'stages'>>(row.payload_json);
      const stages = await this.database.getAllAsync<Omit<SleepStage, never>>(
        'SELECT stage, start_time AS startTime, end_time AS endTime, duration_minutes AS durationMinutes FROM sleep_stages WHERE provider = ? AND session_id = ? ORDER BY stage_index',
        provider, session.id,
      );
      return { ...session, stages };
    }));
    const fallbackProvenance = summaries[0]?.activity.provenance ?? { provider, recordedBy: 'unknown' as const, aggregation: 'raw' as const, syncedAt: new Date(0).toISOString() };
    const states = importRow ? parseJson<CollectionStates>(importRow.collection_states_json) : null;
    const hydrate = <T>(key: DetailedCollectionKey, values: T[]): HealthMetric<T[]> => {
      const state = states?.[key];
      if (!state) return missingMetric('No persisted import coverage exists for this detailed collection and range.', fallbackProvenance);
      if (state.status === 'available') return availableMetric(values, state.provenance);
      return state as HealthMetric<T[]>;
    };
    return {
      range,
      dailySummaries: availableMetric(summaries, { ...fallbackProvenance, aggregation: 'daily' }),
      sleepSessions: hydrate('sleepSessions', sessions),
      heartRateSamples: hydrate('heartRateSamples', heartRows.map((row) => parseJson<HeartRateSample>(row.payload_json))),
      hrvObservations: hydrate('hrvObservations', hrvRows.map((row) => parseJson<HrvObservation>(row.payload_json))),
      oxygenSaturationSamples: hydrate('oxygenSaturationSamples', spo2Rows.map((row) => parseJson<OxygenSaturationSample>(row.payload_json))),
      workouts: hydrate('workouts', workoutRows.map((row) => parseJson<WorkoutSession>(row.payload_json))),
    };
  }

  async recordSyncAttempt(provider: HealthMetricSource, range: DateRange, attemptedAt: string): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO sync_metadata (provider, status, last_attempted_at, start_date, end_date, time_zone)
       VALUES (?, 'running', ?, ?, ?, ?)
       ON CONFLICT(provider) DO UPDATE SET status='running', last_attempted_at=excluded.last_attempted_at, start_date=excluded.start_date, end_date=excluded.end_date, time_zone=excluded.time_zone, error=NULL`,
      provider, attemptedAt, range.start, range.end, range.timeZone,
    );
  }

  async recordSyncFailure(provider: HealthMetricSource, range: DateRange, attemptedAt: string, error: string): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO sync_metadata (provider, status, last_attempted_at, start_date, end_date, time_zone, error)
       VALUES (?, 'failed', ?, ?, ?, ?, ?)
       ON CONFLICT(provider) DO UPDATE SET status='failed', last_attempted_at=excluded.last_attempted_at, start_date=excluded.start_date, end_date=excluded.end_date, time_zone=excluded.time_zone, error=excluded.error`,
      provider, attemptedAt, range.start, range.end, range.timeZone, error,
    );
  }

  async getSyncMetadata(provider: HealthMetricSource): Promise<HealthSyncMetadata | null> {
    const row = await this.database.getFirstAsync<SyncRow>('SELECT * FROM sync_metadata WHERE provider = ?', provider);
    if (!row) return null;
    return {
      provider: row.provider,
      status: row.status,
      lastAttemptedAt: row.last_attempted_at,
      lastSuccessfulAt: row.last_successful_at ?? undefined,
      range: row.start_date && row.end_date && row.time_zone ? { start: row.start_date, end: row.end_date, timeZone: row.time_zone } : undefined,
      error: row.error ?? undefined,
    };
  }

  async getStats(provider: HealthMetricSource): Promise<StoredHealthStats> {
    const row = await this.database.getFirstAsync<CountRow>(
      'SELECT COUNT(*) AS count, MIN(local_date) AS first_date, MAX(local_date) AS last_date FROM daily_summaries WHERE provider = ?',
      provider,
    );
    return { provider, storedDays: row?.count ?? 0, firstDate: row?.first_date ?? undefined, lastDate: row?.last_date ?? undefined, schemaVersion: await getSchemaVersion(this.database), sync: await this.getSyncMetadata(provider) };
  }

  async applyRetention(policy: RetentionPolicy, asOfDate: string): Promise<number> {
    if (!Number.isInteger(policy.detailedDataDays) || policy.detailedDataDays < 1) throw new Error('Detailed-data retention must be a positive whole number of days.');
    const cutoff = addLocalDays(asOfDate, -(policy.detailedDataDays - 1));
    let changes = 0;
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      for (const table of ['sleep_sessions', 'heart_rate_samples', 'hrv_observations', 'oxygen_saturation_samples', 'workouts']) {
        changes += (await transaction.runAsync(`DELETE FROM ${table} WHERE local_date < ?`, cutoff)).changes;
      }
      await transaction.runAsync('DELETE FROM import_ranges WHERE end_date < ?', cutoff);
      await transaction.runAsync('UPDATE import_ranges SET start_date = ? WHERE start_date < ? AND end_date >= ?', cutoff, cutoff, cutoff);
    });
    return changes;
  }

  async deleteDetailedHealthData(provider?: HealthMetricSource): Promise<number> {
    let changes = 0;
    const clause = provider ? ' WHERE provider = ?' : '';
    const params = provider ? [provider] : [];
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      for (const table of ['sleep_sessions', 'heart_rate_samples', 'hrv_observations', 'oxygen_saturation_samples', 'workouts', 'import_ranges']) {
        changes += (await transaction.runAsync(`DELETE FROM ${table}${clause}`, ...params)).changes;
      }
    });
    return changes;
  }

  async deleteAllLocalHealthData(): Promise<number> {
    let changes = 0;
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      for (const table of ['sleep_sessions', 'heart_rate_samples', 'hrv_observations', 'oxygen_saturation_samples', 'workouts', 'daily_summaries', 'import_ranges', 'sync_metadata']) {
        changes += (await transaction.runAsync(`DELETE FROM ${table}`)).changes;
      }
    });
    return changes;
  }
}
