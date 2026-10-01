import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '../models/notifications';
import { decideDailyReminderSchedule, formatReminderTime, isValidReminderTime } from './notificationPolicy';

const preferences = (overrides: Partial<NotificationPreferences> = {}): NotificationPreferences => ({
  ...DEFAULT_NOTIFICATION_PREFERENCES,
  ...overrides,
  reminderTime: overrides.reminderTime ?? DEFAULT_NOTIFICATION_PREFERENCES.reminderTime,
});

describe('notification scheduling policy', () => {
  test('does nothing by default and never infers health-data freshness', () => {
    expect(decideDailyReminderSchedule(preferences(), 'not-determined', [])).toEqual({ action: 'none' });
  });

  test.each(['denied', 'unavailable', 'error'] as const)('cancels owned schedules when permission is %s', (permission) => {
    expect(decideDailyReminderSchedule(preferences({ enabled: true }), permission, ['owned'])).toEqual({ action: 'cancel', ids: ['owned'] });
  });

  test('schedules one daily reminder when both preferences and permission allow it', () => {
    expect(decideDailyReminderSchedule(preferences({ enabled: true }), 'granted', [])).toEqual({ action: 'replace', ids: [], time: { hour: 9, minute: 0 } });
  });

  test('is idempotent for the exact persisted native schedule', () => {
    expect(decideDailyReminderSchedule(preferences({ enabled: true, scheduledReminder: { id: 'one', hour: 9, minute: 0 } }), 'granted', ['one'])).toEqual({ action: 'none' });
  });

  test('replaces duplicates and stale schedule metadata', () => {
    expect(decideDailyReminderSchedule(preferences({ enabled: true, reminderTime: { hour: 20, minute: 15 }, scheduledReminder: { id: 'old', hour: 9, minute: 0 } }), 'granted', ['old', 'duplicate', 'old'])).toEqual({ action: 'replace', ids: ['old', 'duplicate'], time: { hour: 20, minute: 15 } });
  });

  test('daily reminder preference can suppress an otherwise allowed schedule', () => {
    expect(decideDailyReminderSchedule(preferences({ enabled: true, dailyReminderEnabled: false }), 'granted', ['one'])).toEqual({ action: 'cancel', ids: ['one'] });
  });

  test('validates and formats local reminder time', () => {
    expect(isValidReminderTime({ hour: 23, minute: 59 })).toBe(true);
    expect(isValidReminderTime({ hour: 24, minute: 0 })).toBe(false);
    expect(isValidReminderTime({ hour: 8, minute: 7.5 })).toBe(false);
    expect(formatReminderTime({ hour: 8, minute: 5 })).toBe('08:05');
  });
});
