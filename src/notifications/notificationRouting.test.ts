import { notificationRouteFromData } from './notificationRouting';

describe('notification tap routing', () => {
  test.each([
    [{ url: '/' }, '/'],
    [{ url: '/insights' }, '/insights'],
    [{ url: '/settings' }, null],
    [{ url: 'https://example.com' }, null],
    [{ url: 4 }, null],
    [undefined, null],
  ] as const)('allow-lists safe in-app routes', (data, expected) => {
    expect(notificationRouteFromData(data)).toBe(expected);
  });
});
