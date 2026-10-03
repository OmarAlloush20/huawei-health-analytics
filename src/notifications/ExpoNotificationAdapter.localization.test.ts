import * as Notifications from 'expo-notifications';
import { publishLanguage, tr } from '../localization/i18n';
import { DAILY_REMINDER_BODY, DAILY_REMINDER_TITLE, DAILY_REMINDER_TYPE, NOTIFICATION_OWNER } from '../services/notificationPolicy';
import { DAILY_REMINDER_CHANNEL_ID, ExpoNotificationAdapter } from './ExpoNotificationAdapter';

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('schedule-id'),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));
afterEach(() => { publishLanguage('en'); jest.clearAllMocks(); });
test.each(['en', 'ar'] as const)('reminder copy in %s preserves timing, owner, type, privacy and route', async (language) => {
  publishLanguage(language);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  await new ExpoNotificationAdapter().scheduleDailyReminder({ hour: 9, minute: 15 });
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
    content: { title: DAILY_REMINDER_TITLE, body: tr('notification.body'), data: { notificationOwner: NOTIFICATION_OWNER, notificationType: DAILY_REMINDER_TYPE, url: '/' } },
    trigger: { type: 'daily', hour: 9, minute: 15, channelId: DAILY_REMINDER_CHANNEL_ID },
  });
  if (language === 'en') expect(tr('notification.body')).toBe(DAILY_REMINDER_BODY);
});
