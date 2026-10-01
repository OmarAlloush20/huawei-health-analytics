import type { DailyReminderTime, NotificationPermissionState, NotificationPreferences } from '../models/notifications';

export const DAILY_REMINDER_TITLE = 'Health Analytics';
export const DAILY_REMINDER_BODY = "Review today's health summary.";
export const NOTIFICATION_OWNER = 'huawei-health-analytics';
export const DAILY_REMINDER_TYPE = 'daily-summary-reminder';

export type NotificationScheduleDecision =
  | { action: 'none' }
  | { action: 'cancel'; ids: string[] }
  | { action: 'replace'; ids: string[]; time: DailyReminderTime };

export function decideDailyReminderSchedule(
  preferences: NotificationPreferences,
  permission: NotificationPermissionState,
  ownedScheduleIds: readonly string[],
): NotificationScheduleDecision {
  const ids = [...new Set(ownedScheduleIds)];
  const shouldSchedule = preferences.enabled && preferences.dailyReminderEnabled && permission === 'granted';
  if (!shouldSchedule) return ids.length > 0 ? { action: 'cancel', ids } : { action: 'none' };

  const metadata = preferences.scheduledReminder;
  const isCurrent = metadata !== null
    && ids.length === 1
    && ids[0] === metadata.id
    && metadata.hour === preferences.reminderTime.hour
    && metadata.minute === preferences.reminderTime.minute;
  if (isCurrent) return { action: 'none' };
  return { action: 'replace', ids, time: preferences.reminderTime };
}

export function isValidReminderTime(time: DailyReminderTime): boolean {
  return Number.isInteger(time.hour)
    && time.hour >= 0
    && time.hour <= 23
    && Number.isInteger(time.minute)
    && time.minute >= 0
    && time.minute <= 59;
}

export function formatReminderTime(time: DailyReminderTime): string {
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
}
