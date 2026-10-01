import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { notificationRouteFromData } from './notificationRouting';

export function useNotificationRouting(): void {
  useEffect(() => {
    const redirect = (notification: Notifications.Notification) => {
      const route = notificationRouteFromData(notification.request.content.data);
      if (route) router.push(route);
    };
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse?.notification) redirect(lastResponse.notification);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => redirect(response.notification));
    return () => subscription.remove();
  }, []);
}
