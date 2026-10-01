import type { DateRange, HealthMetricSource, IsoTimestamp } from '../models/health';

export type SqlBindValue = string | number | null | Uint8Array;

export interface SqlRunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface SqlExecutor {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqlBindValue[]): Promise<SqlRunResult>;
  getFirstAsync<T>(sql: string, ...params: SqlBindValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SqlBindValue[]): Promise<T[]>;
}

export interface HealthDatabase extends SqlExecutor {
  withExclusiveTransactionAsync(task: (transaction: SqlExecutor) => Promise<void>): Promise<void>;
}

export type SyncStatus = 'running' | 'succeeded' | 'failed';

export interface HealthSyncMetadata {
  provider: HealthMetricSource;
  status: SyncStatus;
  lastAttemptedAt: IsoTimestamp;
  lastSuccessfulAt?: IsoTimestamp;
  range?: DateRange;
  error?: string;
}

export interface StoredHealthStats {
  provider: HealthMetricSource;
  storedDays: number;
  firstDate?: string;
  lastDate?: string;
  schemaVersion: number;
  sync: HealthSyncMetadata | null;
}

export interface RetentionPolicy {
  detailedDataDays: number;
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = { detailedDataDays: 90 };
