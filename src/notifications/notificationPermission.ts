import type { NotificationPermissionState } from '../models/notifications';

export interface PermissionResponseLike {
  granted: boolean;
  status: string;
  canAskAgain: boolean;
  provisional?: boolean;
}

export function notificationPermissionFromResponse(response: PermissionResponseLike): NotificationPermissionState {
  if (response.granted || response.provisional) return 'granted';
  if (response.status === 'undetermined' || response.canAskAgain) return 'not-determined';
  return 'denied';
}
