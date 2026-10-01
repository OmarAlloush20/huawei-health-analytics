export type NotificationPermissionState =
  | 'not-determined'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'error';

export interface DailyReminderTime {
  hour: number;
  minute: number;
}

export interface ScheduledReminderMetadata extends DailyReminderTime {
  id: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  dailyReminderEnabled: boolean;
  reminderTime: DailyReminderTime;
  scheduledReminder: ScheduledReminderMetadata | null;
  updatedAt: string;
}

export interface NotificationSettingsSnapshot {
  preferences: NotificationPreferences;
  permission: NotificationPermissionState;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: false,
  dailyReminderEnabled: true,
  reminderTime: { hour: 9, minute: 0 },
  scheduledReminder: null,
  updatedAt: '1970-01-01T00:00:00.000Z',
};
