import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPermissionState, type NotificationPreferences, type ScheduledReminderMetadata } from '../models/notifications';
import type { NotificationAdapter } from '../notifications/NotificationAdapter';
import type { NotificationPreferencesRepository } from '../repositories/NotificationPreferencesRepository';
import { NotificationSettingsService } from './NotificationSettingsService';

class MemoryPreferences implements NotificationPreferencesRepository {
  value: NotificationPreferences = structuredClone(DEFAULT_NOTIFICATION_PREFERENCES);
  async get() { return structuredClone(this.value); }
  async setEnabled(enabled: boolean, updatedAt: string) { this.value = { ...this.value, enabled, updatedAt }; }
  async setDailyReminderEnabled(dailyReminderEnabled: boolean, updatedAt: string) { this.value = { ...this.value, dailyReminderEnabled, updatedAt }; }
  async setReminderTime(hour: number, minute: number, updatedAt: string) { this.value = { ...this.value, reminderTime: { hour, minute }, updatedAt }; }
  async setScheduledReminder(scheduledReminder: ScheduledReminderMetadata | null, updatedAt: string) { this.value = { ...this.value, scheduledReminder, updatedAt }; }
}

class FakeAdapter implements NotificationAdapter {
  permission: NotificationPermissionState = 'not-determined';
  requestResult: NotificationPermissionState = 'granted';
  ids: string[] = [];
  events: string[] = [];
  async getPermission() { return this.permission; }
  async requestPermission() { this.events.push('request'); this.permission = this.requestResult; return this.requestResult; }
  async ensureDailyReminderChannel() { this.events.push('channel'); }
  async getOwnedScheduleIds() { return [...this.ids]; }
  async scheduleDailyReminder(time: { hour: number; minute: number }) { this.events.push(`schedule:${time.hour}:${time.minute}`); this.ids = ['scheduled-1']; return 'scheduled-1'; }
  async cancelSchedule(id: string) { this.events.push(`cancel:${id}`); this.ids = this.ids.filter((value) => value !== id); }
}

describe('NotificationSettingsService', () => {
  let repository: MemoryPreferences;
  let adapter: FakeAdapter;
  let service: NotificationSettingsService;

  beforeEach(() => {
    repository = new MemoryPreferences();
    adapter = new FakeAdapter();
    service = new NotificationSettingsService(repository, adapter, () => '2026-10-01T08:00:00.000Z');
  });

  test('reads defaults without prompting or scheduling', async () => {
    expect(await service.getSettings()).toMatchObject({ preferences: { enabled: false, dailyReminderEnabled: true, reminderTime: { hour: 9, minute: 0 } }, permission: 'not-determined' });
    expect(adapter.events).toEqual([]);
  });

  test('explicit enable creates the Android channel, requests permission, and schedules', async () => {
    await service.setEnabled(true);
    expect(adapter.events).toEqual(['channel', 'request', 'channel', 'schedule:9:0']);
    expect(repository.value).toMatchObject({ enabled: true, scheduledReminder: { id: 'scheduled-1', hour: 9, minute: 0 } });
  });

  test('denied permission keeps settings usable without scheduling', async () => {
    adapter.requestResult = 'denied';
    const result = await service.setEnabled(true);
    expect(result.permission).toBe('denied');
    expect(result.preferences.enabled).toBe(true);
    expect(adapter.events).toEqual(['channel', 'request']);
  });

  test('does not repeat a prompt after permission was denied', async () => {
    adapter.permission = 'denied';
    await service.setEnabled(true);
    expect(adapter.events).toEqual([]);
  });

  test('time changes cancel the owned schedule and replace it exactly once', async () => {
    adapter.permission = 'granted';
    repository.value = { ...repository.value, enabled: true, scheduledReminder: { id: 'old', hour: 9, minute: 0 } };
    adapter.ids = ['old'];
    await service.setReminderTime({ hour: 18, minute: 30 });
    expect(adapter.events).toEqual(['cancel:old', 'channel', 'schedule:18:30']);
    expect(repository.value.scheduledReminder).toEqual({ id: 'scheduled-1', hour: 18, minute: 30 });
  });

  test('repeated reads deduplicate corrupt app-owned schedules', async () => {
    adapter.permission = 'granted';
    repository.value = { ...repository.value, enabled: true };
    adapter.ids = ['a', 'b'];
    await service.getSettings();
    expect(adapter.events).toEqual(['cancel:a', 'cancel:b', 'channel', 'schedule:9:0']);
    adapter.events = [];
    await service.getSettings();
    expect(adapter.events).toEqual([]);
  });

  test('disable cancels only adapter-reported app-owned schedules', async () => {
    adapter.permission = 'granted';
    repository.value = { ...repository.value, enabled: true, scheduledReminder: { id: 'ours', hour: 9, minute: 0 } };
    adapter.ids = ['ours'];
    await service.setEnabled(false);
    expect(adapter.events).toEqual(['cancel:ours']);
    expect(repository.value.scheduledReminder).toBeNull();
  });

  test('daily opt-out cancels its schedule and invalid time is rejected', async () => {
    adapter.permission = 'granted';
    repository.value = { ...repository.value, enabled: true, scheduledReminder: { id: 'ours', hour: 9, minute: 0 } };
    adapter.ids = ['ours'];
    await service.setDailyReminderEnabled(false);
    expect(adapter.events).toEqual(['cancel:ours']);
    await expect(service.setReminderTime({ hour: 25, minute: 0 })).rejects.toThrow('valid local reminder time');
  });

  test.each(['unavailable', 'error'] as const)('surfaces %s permission state without making the app unusable', async (permission) => {
    adapter.permission = permission;
    adapter.getOwnedScheduleIds = async () => { throw new Error('native module unavailable'); };
    await expect(service.getSettings()).resolves.toMatchObject({ permission, preferences: { enabled: false } });
  });
});
