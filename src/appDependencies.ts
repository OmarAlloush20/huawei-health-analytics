import { MockHealthProvider } from './providers/mock/MockHealthProvider';
import type { HealthDataProvider } from './providers/HealthDataProvider';
import { HuaweiHealthProvider } from './providers/huawei/HuaweiHealthProvider';
import { ProviderHealthSummaryRepository } from './repositories/HealthSummaryRepository';
import { HealthOverviewService } from './services/HealthOverviewService';
import { openHealthDatabase } from './database/expoDatabase';
import { SQLiteHealthRepository } from './repositories/SQLiteHealthRepository';
import { HealthSyncService } from './services/HealthSyncService';
import { DashboardDataService } from './services/DashboardDataService';
import { BaselineService } from './services/BaselineService';
import { RecoveryService } from './services/RecoveryService';
import { TrendsService } from './services/TrendsService';
import { InsightsService } from './services/InsightsService';
import { SQLiteNotificationPreferencesRepository } from './repositories/NotificationPreferencesRepository';
import { ExpoNotificationAdapter } from './notifications/ExpoNotificationAdapter';
import { NotificationSettingsService } from './services/NotificationSettingsService';

function createHealthProvider(): HealthDataProvider {
  if (process.env.EXPO_PUBLIC_HEALTH_PROVIDER !== 'huawei') {
    return new MockHealthProvider();
  }

  return new HuaweiHealthProvider({
    agConnectConfigured:
      process.env.EXPO_PUBLIC_HUAWEI_AGCONNECT_CONFIGURED === 'true',
    appGalleryConfigured:
      process.env.EXPO_PUBLIC_HUAWEI_APP_CONFIGURED === 'true',
    healthServiceStepScopeApproved:
      process.env.EXPO_PUBLIC_HUAWEI_HEALTH_SCOPE_APPROVED === 'true',
  });
}

const healthProvider = createHealthProvider();
const healthRepository = new ProviderHealthSummaryRepository(healthProvider);
const databasePromise = openHealthDatabase();
const persistencePromise = databasePromise.then((database) => {
  const repository = new SQLiteHealthRepository(database);
  const syncService = new HealthSyncService(healthProvider, repository);
  const baselineService = new BaselineService(healthProvider.id, repository);
  const recoveryService = new RecoveryService(baselineService);
  const trendsService = new TrendsService(healthProvider.id, repository);
  const insightsService = new InsightsService(trendsService);
  const notificationPreferences = new SQLiteNotificationPreferencesRepository(database);
  const notificationSettingsService = new NotificationSettingsService(notificationPreferences, new ExpoNotificationAdapter());
  return {
    database,
    repository,
    syncService,
    baselineService,
    recoveryService,
    trendsService,
    insightsService,
    notificationPreferences,
    notificationSettingsService,
    dashboardService: new DashboardDataService(healthProvider, database, repository, syncService, recoveryService, insightsService),
  };
});

export const appDependencies = {
  healthOverviewService: new HealthOverviewService(healthRepository),
  healthProvider,
  getPersistence: () => persistencePromise,
};
