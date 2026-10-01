export type HuaweiAuthorizationState =
  | 'not-performed'
  | 'authorized'
  | 'denied';

export type HuaweiQueryState = 'not-run' | 'succeeded' | 'failed';

export interface HuaweiIntegrationState {
  nativeModule: 'ready' | 'unavailable';
  agConnectConfiguration: 'configured' | 'missing';
  appGalleryApplication: 'configured' | 'not-configured';
  healthServiceStepScope: 'approved' | 'pending';
  userAuthorization: HuaweiAuthorizationState;
  stepQuery: HuaweiQueryState;
  lastError?: string;
}

export type HuaweiIntegrationErrorCode =
  | 'native-module-unavailable'
  | 'agconnect-configuration-missing'
  | 'appgallery-application-not-configured'
  | 'health-service-scope-pending'
  | 'user-authorization-not-performed'
  | 'authorization-denied'
  | 'huawei-api-query-failed';

export class HuaweiHealthIntegrationError extends Error {
  constructor(
    readonly code: HuaweiIntegrationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'HuaweiHealthIntegrationError';
  }
}
