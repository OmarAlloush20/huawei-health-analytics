import type { HealthDatabase } from '../database/types';
import type { NotificationPreferences, ScheduledReminderMetadata } from '../models/notifications';

interface NotificationPreferencesRow {
  enabled: number;
  daily_reminder_enabled: number;
  reminder_hour: number;
  reminder_minute: number;
  scheduled_notification_id: string | null;
  scheduled_hour: number | null;
  scheduled_minute: number | null;
  updated_at: string;
}

export interface NotificationPreferencesRepository {
  get(): Promise<NotificationPreferences>;
  setEnabled(enabled: boolean, updatedAt: string): Promise<void>;
  setDailyReminderEnabled(enabled: boolean, updatedAt: string): Promise<void>;
  setReminderTime(hour: number, minute: number, updatedAt: string): Promise<void>;
  setScheduledReminder(metadata: ScheduledReminderMetadata | null, updatedAt: string): Promise<void>;
}

export class SQLiteNotificationPreferencesRepository implements NotificationPreferencesRepository {
  constructor(private readonly database: HealthDatabase) {}

  async get(): Promise<NotificationPreferences> {
    const row = await this.database.getFirstAsync<NotificationPreferencesRow>(
      'SELECT enabled, daily_reminder_enabled, reminder_hour, reminder_minute, scheduled_notification_id, scheduled_hour, scheduled_minute, updated_at FROM notification_preferences WHERE id = 1',
    );
    if (!row) throw new Error('Notification preferences are unavailable.');
    return {
      enabled: row.enabled === 1,
      dailyReminderEnabled: row.daily_reminder_enabled === 1,
      reminderTime: { hour: row.reminder_hour, minute: row.reminder_minute },
      scheduledReminder: toScheduledReminder(row),
      updatedAt: row.updated_at,
    };
  }

  async setEnabled(enabled: boolean, updatedAt: string): Promise<void> {
    await this.database.runAsync('UPDATE notification_preferences SET enabled = ?, updated_at = ? WHERE id = 1', enabled ? 1 : 0, updatedAt);
  }

  async setDailyReminderEnabled(enabled: boolean, updatedAt: string): Promise<void> {
    await this.database.runAsync('UPDATE notification_preferences SET daily_reminder_enabled = ?, updated_at = ? WHERE id = 1', enabled ? 1 : 0, updatedAt);
  }

  async setReminderTime(hour: number, minute: number, updatedAt: string): Promise<void> {
    await this.database.runAsync('UPDATE notification_preferences SET reminder_hour = ?, reminder_minute = ?, updated_at = ? WHERE id = 1', hour, minute, updatedAt);
  }

  async setScheduledReminder(metadata: ScheduledReminderMetadata | null, updatedAt: string): Promise<void> {
    await this.database.runAsync(
      'UPDATE notification_preferences SET scheduled_notification_id = ?, scheduled_hour = ?, scheduled_minute = ?, updated_at = ? WHERE id = 1',
      metadata?.id ?? null,
      metadata?.hour ?? null,
      metadata?.minute ?? null,
      updatedAt,
    );
  }
}

function toScheduledReminder(row: NotificationPreferencesRow): ScheduledReminderMetadata | null {
  if (row.scheduled_notification_id === null || row.scheduled_hour === null || row.scheduled_minute === null) return null;
  return { id: row.scheduled_notification_id, hour: row.scheduled_hour, minute: row.scheduled_minute };
}
