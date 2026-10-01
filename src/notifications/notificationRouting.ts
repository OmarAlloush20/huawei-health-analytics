export type NotificationRoute = '/' | '/insights';

export function notificationRouteFromData(data: Record<string, unknown> | undefined): NotificationRoute | null {
  const url = data?.url;
  return url === '/' || url === '/insights' ? url : null;
}
