import { notificationPermissionFromResponse } from './notificationPermission';

describe('notification permission mapping', () => {
  test('treats Android denied-with-canAskAgain as never prompted', () => {
    expect(notificationPermissionFromResponse({ granted: false, status: 'denied', canAskAgain: true })).toBe('not-determined');
  });

  test('keeps a final denial distinct', () => {
    expect(notificationPermissionFromResponse({ granted: false, status: 'denied', canAskAgain: false })).toBe('denied');
  });

  test('accepts normal and provisional grants', () => {
    expect(notificationPermissionFromResponse({ granted: true, status: 'granted', canAskAgain: true })).toBe('granted');
    expect(notificationPermissionFromResponse({ granted: false, status: 'denied', canAskAgain: false, provisional: true })).toBe('granted');
  });
});
