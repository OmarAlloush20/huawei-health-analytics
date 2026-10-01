import type { DailyReminderTime, NotificationPermissionState } from '../models/notifications';

export interface NotificationAdapter {
  getPermission(): Promise<NotificationPermissionState>;
  requestPermission(): Promise<NotificationPermissionState>;
  ensureDailyReminderChannel(): Promise<void>;
  getOwnedScheduleIds(): Promise<string[]>;
  scheduleDailyReminder(time: DailyReminderTime): Promise<string>;
  cancelSchedule(id: string): Promise<void>;
}
