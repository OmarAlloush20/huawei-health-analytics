import type { HealthDatabase } from '../database/types';

export type ThemeMode = 'system' | 'dark' | 'light';

interface AppearancePreferencesRow {
  theme_mode: ThemeMode;
}

export interface AppearancePreferencesRepository {
  getThemeMode(): Promise<ThemeMode>;
  setThemeMode(mode: ThemeMode, updatedAt: string): Promise<void>;
}

export class SQLiteAppearancePreferencesRepository implements AppearancePreferencesRepository {
  constructor(private readonly database: HealthDatabase) {}

  async getThemeMode(): Promise<ThemeMode> {
    const row = await this.database.getFirstAsync<AppearancePreferencesRow>(
      'SELECT theme_mode FROM appearance_preferences WHERE id = 1',
    );
    return row?.theme_mode ?? 'system';
  }

  async setThemeMode(mode: ThemeMode, updatedAt: string): Promise<void> {
    await this.database.runAsync(
      'UPDATE appearance_preferences SET theme_mode = ?, updated_at = ? WHERE id = 1',
      mode,
      updatedAt,
    );
  }
}
