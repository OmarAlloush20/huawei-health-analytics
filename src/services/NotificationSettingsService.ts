import type { DailyReminderTime, NotificationPermissionState, NotificationSettingsSnapshot } from '../models/notifications';
import type { NotificationAdapter } from '../notifications/NotificationAdapter';
import type { NotificationPreferencesRepository } from '../repositories/NotificationPreferencesRepository';
import { decideDailyReminderSchedule, isValidReminderTime } from './notificationPolicy';

export class NotificationSettingsService {
  constructor(
    private readonly repository: NotificationPreferencesRepository,
    private readonly adapter: NotificationAdapter,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async getSettings(): Promise<NotificationSettingsSnapshot> {
    const permission = await this.adapter.getPermission();
    await this.reconcile(permission);
    return { preferences: await this.repository.get(), permission };
  }

  async setEnabled(enabled: boolean): Promise<NotificationSettingsSnapshot> {
    let permission = await this.adapter.getPermission();
    if (enabled && permission === 'not-determined') {
      await this.adapter.ensureDailyReminderChannel();
      permission = await this.adapter.requestPermission();
    }
    await this.repository.setEnabled(enabled, this.now());
    await this.reconcile(permission);
    return { preferences: await this.repository.get(), permission };
  }

  async setDailyReminderEnabled(enabled: boolean): Promise<NotificationSettingsSnapshot> {
    await this.repository.setDailyReminderEnabled(enabled, this.now());
    const permission = await this.adapter.getPermission();
    await this.reconcile(permission);
    return { preferences: await this.repository.get(), permission };
  }

  async setReminderTime(time: DailyReminderTime): Promise<NotificationSettingsSnapshot> {
    if (!isValidReminderTime(time)) throw new Error('Choose a valid local reminder time.');
    await this.repository.setReminderTime(time.hour, time.minute, this.now());
    const permission = await this.adapter.getPermission();
    await this.reconcile(permission);
    return { preferences: await this.repository.get(), permission };
  }

  private async reconcile(permission: NotificationPermissionState): Promise<void> {
    const preferences = await this.repository.get();
    let ownedIds: string[];
    try {
      ownedIds = await this.adapter.getOwnedScheduleIds();
    } catch (error) {
      if (permission === 'unavailable' || permission === 'error') return;
      throw error;
    }
    const decision = decideDailyReminderSchedule(preferences, permission, ownedIds);
    if (decision.action === 'none') {
      if (ownedIds.length === 0 && preferences.scheduledReminder) {
        await this.repository.setScheduledReminder(null, this.now());
      }
      return;
    }
    for (const id of decision.ids) await this.adapter.cancelSchedule(id);
    await this.repository.setScheduledReminder(null, this.now());
    if (decision.action === 'replace') {
      await this.adapter.ensureDailyReminderChannel();
      const id = await this.adapter.scheduleDailyReminder(decision.time);
      await this.repository.setScheduledReminder({ id, ...decision.time }, this.now());
    }
  }
}
