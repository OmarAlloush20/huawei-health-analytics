import * as SQLite from 'expo-sqlite';

import { migrateHealthDatabase } from './migrations';
import type { HealthDatabase, SqlBindValue, SqlExecutor } from './types';

export const HEALTH_DATABASE_NAME = 'health-analytics.db';

function executor(database: SQLite.SQLiteDatabase): SqlExecutor {
  return {
    execAsync: (sql) => database.execAsync(sql),
    runAsync: (sql, ...params) => database.runAsync(sql, ...params),
    getFirstAsync: <T>(sql: string, ...params: SqlBindValue[]) => database.getFirstAsync<T>(sql, ...params),
    getAllAsync: <T>(sql: string, ...params: SqlBindValue[]) => database.getAllAsync<T>(sql, ...params),
  };
}

export async function openHealthDatabase(): Promise<HealthDatabase> {
  const sqlite = await SQLite.openDatabaseAsync(HEALTH_DATABASE_NAME);
  const database: HealthDatabase = {
    ...executor(sqlite),
    withExclusiveTransactionAsync: (task) => sqlite.withExclusiveTransactionAsync(
      async (transaction) => task(executor(transaction)),
    ),
  };
  await migrateHealthDatabase(database);
  return database;
}
