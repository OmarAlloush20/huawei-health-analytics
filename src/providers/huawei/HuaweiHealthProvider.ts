import { NativeModules } from 'react-native';

import type {
  AuthorizationResult,
  DailyHealthSummary,
  DataProvenance,
  DateRange,
  HealthDayQuery,
  HealthPermission,
  NormalizedHealthData,
} from '../../models/health';
import { availableMetric, unsupportedMetric, withCompleteness } from '../../models/healthMetrics';
import { enumerateLocalDates, parseLocalDate } from '../../shared/dates/healthDates';
import type { HealthDataProvider } from '../HealthDataProvider';
import {
  HuaweiHealthIntegrationError,
  type HuaweiIntegrationState,
} from './HuaweiIntegrationState';

const STEP_PERMISSION: HealthPermission = 'steps:read';
const STEP_SCOPE = 'https://www.huawei.com/healthkit/step.read';

interface HuaweiResult<T> {
  isSuccess?: boolean;
  body?: T;
  errorMessage?: string;
  returnCode?: number;
  statusCode?: number;
}

interface HuaweiAccountBody {
  authorizedScopes?: string[];
}

interface HuaweiSamplePoint {
  fieldValues?: Record<string, unknown>;
}

interface HuaweiSampleSet {
  isEmpty?: boolean;
  samplePoints?: HuaweiSamplePoint[];
}

interface HuaweiHealthAccountModule {
  HEALTHKIT_STEP_READ?: string;
  signIn?: (scopes: string[]) => Promise<HuaweiResult<HuaweiAccountBody>>;
}

interface HuaweiDataControllerModule {
  DT_CONTINUOUS_STEPS_DELTA?: string;
  initDataController?: () => Promise<HuaweiResult<unknown>>;
  readDailySummation?: (
    dataType: { dataType: string },
    startDate: number,
    endDate: number,
  ) => Promise<HuaweiResult<HuaweiSampleSet>>;
}

interface HuaweiNativeModules {
  account?: HuaweiHealthAccountModule;
  data?: HuaweiDataControllerModule;
}

export interface HuaweiHealthProviderOptions {
  agConnectConfigured: boolean;
  appGalleryConfigured: boolean;
  healthServiceStepScopeApproved: boolean;
}

function getNativeModules(): HuaweiNativeModules {
  return {
    account: NativeModules.HmsHealthAccount as HuaweiHealthAccountModule | undefined,
    data: NativeModules.HmsDataController as HuaweiDataControllerModule | undefined,
  };
}

function nativeModuleIsReady(modules: HuaweiNativeModules): boolean {
  return (
    typeof modules.account?.signIn === 'function' &&
    typeof modules.data?.readDailySummation === 'function'
  );
}

function parseDateKey(value: string): Date {
  return parseLocalDate(value);
}

function toHuaweiDate(value: string): number {
  return Number(value.replaceAll('-', ''));
}

function readStepValue(fields: Record<string, unknown>): number | undefined {
  const preferredKeys = ['steps_delta', 'steps', 'FIELD_STEPS_DELTA', 'FIELD_STEPS'];
  for (const key of preferredKeys) {
    if (typeof fields[key] === 'number') return fields[key];
  }
  return Object.values(fields).find((value): value is number => typeof value === 'number');
}

function sumSteps(sampleSet: HuaweiSampleSet): number {
  return (sampleSet.samplePoints ?? []).reduce((total, point) => {
    const value = point.fieldValues ? readStepValue(point.fieldValues) : undefined;
    return total + (value ?? 0);
  }, 0);
}

function failureMessage(result: HuaweiResult<unknown>, fallback: string): string {
  const code = result.returnCode ?? result.statusCode;
  const suffix = code === undefined ? '' : ` (Huawei code ${code})`;
  return `${result.errorMessage ?? fallback}${suffix}`;
}

export class HuaweiHealthProvider implements HealthDataProvider {
  readonly id = 'huawei' as const;
  readonly displayName = 'Huawei Health';

  private state: HuaweiIntegrationState;

  constructor(private readonly options: HuaweiHealthProviderOptions) {
    this.state = {
      nativeModule: nativeModuleIsReady(getNativeModules()) ? 'ready' : 'unavailable',
      agConnectConfiguration: options.agConnectConfigured ? 'configured' : 'missing',
      appGalleryApplication: options.appGalleryConfigured ? 'configured' : 'not-configured',
      healthServiceStepScope: options.healthServiceStepScopeApproved ? 'approved' : 'pending',
      userAuthorization: 'not-performed',
      stepQuery: 'not-run',
    };
  }

  getIntegrationState(): Readonly<HuaweiIntegrationState> {
    return { ...this.state };
  }

  async isAvailable(): Promise<boolean> {
    this.state.nativeModule = nativeModuleIsReady(getNativeModules()) ? 'ready' : 'unavailable';
    return this.state.nativeModule === 'ready';
  }

  async requestAuthorization(
    permissions: HealthPermission[],
  ): Promise<AuthorizationResult> {
    const supported = permissions.filter((permission) => permission === STEP_PERMISSION);
    const unsupported = permissions.filter((permission) => permission !== STEP_PERMISSION);
    if (supported.length === 0) return { granted: [], denied: unsupported };

    const { account } = this.requireConfiguration();
    const scope = account.HEALTHKIT_STEP_READ ?? STEP_SCOPE;

    try {
      const result = await account.signIn!([scope]);
      const granted = result.isSuccess === true && result.body?.authorizedScopes?.includes(scope);
      this.state.userAuthorization = granted ? 'authorized' : 'denied';
      this.state.lastError = granted
        ? undefined
        : failureMessage(result, 'Huawei step-read authorization was not granted.');
      return {
        granted: granted ? [STEP_PERMISSION] : [],
        denied: granted ? unsupported : [...supported, ...unsupported],
      };
    } catch (cause) {
      this.state.userAuthorization = 'denied';
      this.state.lastError = cause instanceof Error ? cause.message : 'Huawei authorization failed.';
      throw new HuaweiHealthIntegrationError(
        'authorization-denied',
        this.state.lastError,
        { cause },
      );
    }
  }

  async getDailySummary(query: HealthDayQuery): Promise<DailyHealthSummary | null> {
    parseDateKey(query.date);
    const { data } = this.requireAuthorized();

    try {
      if (typeof data.initDataController === 'function') {
        const initialization = await data.initDataController();
        if (initialization.isSuccess === false) {
          throw new Error(failureMessage(initialization, 'Huawei DataController initialization failed.'));
        }
      }

      const dataType = data.DT_CONTINUOUS_STEPS_DELTA ?? 'DT_CONTINUOUS_STEPS_DELTA';
      const huaweiDate = toHuaweiDate(query.date);
      const result = await data.readDailySummation!({ dataType }, huaweiDate, huaweiDate);
      if (result.isSuccess !== true || !result.body) {
        throw new Error(failureMessage(result, 'Huawei step query failed.'));
      }

      this.state.stepQuery = 'succeeded';
      this.state.lastError = undefined;
      const metricProvenance: DataProvenance = {
        provider: 'huawei',
        recordedBy: 'unknown',
        aggregation: 'daily',
        syncedAt: new Date().toISOString(),
        sourceId: 'huawei-health-service-step-delta',
      };
      return withCompleteness({
        date: query.date,
        timeZone: query.timeZone,
        source: 'huawei',
        activity: availableMetric({ steps: sumSteps(result.body) }, metricProvenance),
        sleep: unsupportedMetric('Sleep reading is outside the Milestone 1 Huawei spike.', metricProvenance),
        heartRate: unsupportedMetric('Heart-rate reading is outside the Milestone 1 Huawei spike.', metricProvenance),
        hrv: unsupportedMetric('HRV reading is outside the Milestone 1 Huawei spike.', metricProvenance),
        oxygenSaturation: unsupportedMetric('SpO2 reading is outside the Milestone 1 Huawei spike.', metricProvenance),
        stress: unsupportedMetric('Stress reading is pending Health Service Kit scope approval.', metricProvenance),
        activityLoad: unsupportedMetric('Activity load calculation is deferred to a later milestone.', metricProvenance),
      });
    } catch (cause) {
      this.state.stepQuery = 'failed';
      this.state.lastError = cause instanceof Error ? cause.message : 'Huawei step query failed.';
      throw new HuaweiHealthIntegrationError(
        'huawei-api-query-failed',
        this.state.lastError,
        { cause },
      );
    }
  }

  async getDailySummaries(range: DateRange): Promise<DailyHealthSummary[]> {
    const summaries: DailyHealthSummary[] = [];
    for (const date of enumerateLocalDates(range)) {
      const summary = await this.getDailySummary({ date, timeZone: range.timeZone });
      if (summary) summaries.push(summary);
    }
    return summaries;
  }

  async getHealthData(range: DateRange): Promise<NormalizedHealthData> {
    const summaries = await this.getDailySummaries(range);
    const provenance: DataProvenance = {
      provider: 'huawei',
      recordedBy: 'unknown',
      aggregation: 'raw',
      syncedAt: new Date().toISOString(),
    };
    const reason = 'This Huawei data type is not implemented in the step-only integration spike.';
    return {
      range,
      dailySummaries: availableMetric(summaries, { ...provenance, aggregation: 'daily' }),
      sleepSessions: unsupportedMetric(reason, provenance),
      heartRateSamples: unsupportedMetric(reason, provenance),
      hrvObservations: unsupportedMetric(reason, provenance),
      oxygenSaturationSamples: unsupportedMetric(reason, provenance),
      workouts: unsupportedMetric(reason, provenance),
    };
  }

  private requireConfiguration(): Required<HuaweiNativeModules> {
    const modules = getNativeModules();
    this.state.nativeModule = nativeModuleIsReady(modules) ? 'ready' : 'unavailable';

    if (this.state.nativeModule === 'unavailable') {
      throw new HuaweiHealthIntegrationError(
        'native-module-unavailable',
        'Huawei Health native module is unavailable. Rebuild the Expo development client.',
      );
    }
    if (!this.options.agConnectConfigured) {
      throw new HuaweiHealthIntegrationError(
        'agconnect-configuration-missing',
        'The private Huawei AGConnect configuration is missing.',
      );
    }
    if (!this.options.appGalleryConfigured) {
      throw new HuaweiHealthIntegrationError(
        'appgallery-application-not-configured',
        'The AppGallery Connect application is not configured.',
      );
    }
    if (!this.options.healthServiceStepScopeApproved) {
      throw new HuaweiHealthIntegrationError(
        'health-service-scope-pending',
        'The Huawei Health Service Kit step-read test scope is still pending.',
      );
    }
    return modules as Required<HuaweiNativeModules>;
  }

  private requireAuthorized(): Required<HuaweiNativeModules> {
    const modules = this.requireConfiguration();
    if (this.state.userAuthorization !== 'authorized') {
      throw new HuaweiHealthIntegrationError(
        'user-authorization-not-performed',
        'Huawei user authorization must succeed before querying steps.',
      );
    }
    return modules;
  }
}
