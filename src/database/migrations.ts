import type { HealthDatabase } from './types';

export const DATABASE_SCHEMA_VERSION = 2;

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'initial_normalized_health_schema',
    sql: `
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE daily_summaries (
        provider TEXT NOT NULL,
        local_date TEXT NOT NULL,
        time_zone TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        PRIMARY KEY (provider, local_date, time_zone)
      );
      CREATE TABLE sleep_sessions (
        provider TEXT NOT NULL,
        session_id TEXT NOT NULL,
        local_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (provider, session_id)
      );
      CREATE TABLE sleep_stages (
        provider TEXT NOT NULL,
        session_id TEXT NOT NULL,
        stage_index INTEGER NOT NULL,
        stage TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        PRIMARY KEY (provider, session_id, stage_index),
        FOREIGN KEY (provider, session_id) REFERENCES sleep_sessions(provider, session_id) ON DELETE CASCADE
      );
      CREATE TABLE heart_rate_samples (
        provider TEXT NOT NULL,
        sample_key TEXT NOT NULL,
        local_date TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (provider, sample_key)
      );
      CREATE TABLE hrv_observations (
        provider TEXT NOT NULL,
        observation_key TEXT NOT NULL,
        local_date TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (provider, observation_key)
      );
      CREATE TABLE oxygen_saturation_samples (
        provider TEXT NOT NULL,
        sample_key TEXT NOT NULL,
        local_date TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (provider, sample_key)
      );
      CREATE TABLE workouts (
        provider TEXT NOT NULL,
        workout_id TEXT NOT NULL,
        local_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (provider, workout_id)
      );
      CREATE TABLE import_ranges (
        provider TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        time_zone TEXT NOT NULL,
        collection_states_json TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        PRIMARY KEY (provider, start_date, end_date, time_zone)
      );
      CREATE TABLE sync_metadata (
        provider TEXT PRIMARY KEY NOT NULL,
        status TEXT NOT NULL,
        last_attempted_at TEXT NOT NULL,
        last_successful_at TEXT,
        start_date TEXT,
        end_date TEXT,
        time_zone TEXT,
        error TEXT
      );
      CREATE INDEX idx_daily_summaries_date ON daily_summaries(provider, local_date);
      CREATE INDEX idx_sleep_sessions_date ON sleep_sessions(provider, local_date);
      CREATE INDEX idx_heart_rate_timestamp ON heart_rate_samples(provider, timestamp);
      CREATE INDEX idx_hrv_timestamp ON hrv_observations(provider, timestamp);
      CREATE INDEX idx_spo2_timestamp ON oxygen_saturation_samples(provider, timestamp);
      CREATE INDEX idx_workouts_date ON workouts(provider, local_date);
    `,
  },
  {
    version: 2,
    name: 'local_notification_preferences',
    sql: `
      CREATE TABLE notification_preferences (
        id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
        enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
        daily_reminder_enabled INTEGER NOT NULL DEFAULT 1 CHECK (daily_reminder_enabled IN (0, 1)),
        reminder_hour INTEGER NOT NULL DEFAULT 9 CHECK (reminder_hour BETWEEN 0 AND 23),
        reminder_minute INTEGER NOT NULL DEFAULT 0 CHECK (reminder_minute BETWEEN 0 AND 59),
        scheduled_notification_id TEXT,
        scheduled_hour INTEGER CHECK (scheduled_hour IS NULL OR scheduled_hour BETWEEN 0 AND 23),
        scheduled_minute INTEGER CHECK (scheduled_minute IS NULL OR scheduled_minute BETWEEN 0 AND 59),
        updated_at TEXT NOT NULL
      );
      INSERT INTO notification_preferences (
        id, enabled, daily_reminder_enabled, reminder_hour, reminder_minute, updated_at
      ) VALUES (1, 0, 1, 9, 0, '1970-01-01T00:00:00.000Z');
    `,
  },
];

export async function getSchemaVersion(database: HealthDatabase): Promise<number> {
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export async function migrateHealthDatabase(database: HealthDatabase): Promise<number> {
  await database.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  let version = await getSchemaVersion(database);
  if (version > DATABASE_SCHEMA_VERSION) {
    throw new Error(`Database schema ${version} is newer than supported version ${DATABASE_SCHEMA_VERSION}.`);
  }

  for (const migration of migrations) {
    if (migration.version <= version) continue;
    if (migration.version !== version + 1) throw new Error(`Missing database migration after version ${version}.`);
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(migration.sql);
      await transaction.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
      await transaction.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    version = migration.version;
  }
  return version;
}

export async function dropHealthSchemaForDevelopment(database: HealthDatabase): Promise<void> {
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync(`
      DROP TABLE IF EXISTS sleep_stages;
      DROP TABLE IF EXISTS sleep_sessions;
      DROP TABLE IF EXISTS heart_rate_samples;
      DROP TABLE IF EXISTS hrv_observations;
      DROP TABLE IF EXISTS oxygen_saturation_samples;
      DROP TABLE IF EXISTS workouts;
      DROP TABLE IF EXISTS daily_summaries;
      DROP TABLE IF EXISTS import_ranges;
      DROP TABLE IF EXISTS sync_metadata;
      DROP TABLE IF EXISTS notification_preferences;
      DROP TABLE IF EXISTS schema_migrations;
      PRAGMA user_version = 0;
    `);
  });
}
