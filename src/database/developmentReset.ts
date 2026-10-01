import { dropHealthSchemaForDevelopment, migrateHealthDatabase } from './migrations';
import type { HealthDatabase } from './types';
import type { DateRange } from '../models/health';
import type { HealthSyncService } from '../services/HealthSyncService';

export async function resetAndReseedDevelopmentDatabase(
  database: HealthDatabase,
  syncService: HealthSyncService,
  range: DateRange,
): Promise<void> {
  if (!__DEV__) throw new Error('Database reset/reseed is available only in development builds.');
  await dropHealthSchemaForDevelopment(database);
  await migrateHealthDatabase(database);
  await syncService.sync(range);
}
