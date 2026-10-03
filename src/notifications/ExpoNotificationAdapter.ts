import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { DailyReminderTime, NotificationPermissionState } from '../models/notifications';
import { DAILY_REMINDER_TITLE, DAILY_REMINDER_TYPE, NOTIFICATION_OWNER } from '../services/notificationPolicy';
import { tr } from '../localization/i18n';
import type { NotificationAdapter } from './NotificationAdapter';
import { notificationPermissionFromResponse } from './notificationPermission';

export const DAILY_REMINDER_CHANNEL_ID = 'daily-health-summary';

export class ExpoNotificationAdapter implements NotificationAdapter {
  async getPermission(): Promise<NotificationPermissionState> {
    try {
      return mapPermission(await Notifications.getPermissionsAsync());
    } catch (error) {
      return isUnavailable(error) ? 'unavailable' : 'error';
    }
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    try {
      return mapPermission(await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: false },
      }));
    } catch (error) {
      return isUnavailable(error) ? 'unavailable' : 'error';
    }
  }

  async ensureDailyReminderChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(DAILY_REMINDER_CHANNEL_ID, {
      name: tr('notification.channel'),
      description: tr('notification.channelHelp'),
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      enableVibrate: false,
      showBadge: false,
    });
  }

  async getOwnedScheduleIds(): Promise<string[]> {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    return requests
      .filter((request) => request.content.data?.notificationOwner === NOTIFICATION_OWNER)
      .map((request) => request.identifier);
  }

  async scheduleDailyReminder(time: DailyReminderTime): Promise<string> {
    return Notifications.scheduleNotificationAsync({
      content: {
        title: DAILY_REMINDER_TITLE,
        body: tr('notification.body'),
        data: {
          notificationOwner: NOTIFICATION_OWNER,
          notificationType: DAILY_REMINDER_TYPE,
          url: '/',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.hour,
        minute: time.minute,
        channelId: DAILY_REMINDER_CHANNEL_ID,
      },
    });
  }

  cancelSchedule(id: string): Promise<void> {
    return Notifications.cancelScheduledNotificationAsync(id);
  }
}

export function configureForegroundNotificationPresentation(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function mapPermission(status: Notifications.NotificationPermissionsStatus): NotificationPermissionState {
  return notificationPermissionFromResponse({
    granted: status.granted,
    status: status.status,
    canAskAgain: status.canAskAgain,
    provisional: status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
  });
}

function isUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unavailable|not available|not supported/i.test(message);
}
