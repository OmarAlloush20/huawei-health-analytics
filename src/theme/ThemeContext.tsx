import { Appearance, useColorScheme } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { appDependencies } from '../appDependencies';
import type { ThemeMode } from '../repositories/AppearancePreferencesRepository';
import { createTheme, type AppTheme } from './theme';
import { useLocale } from '../localization/useLocale';

interface ThemeContextValue {
  mode: ThemeMode;
  theme: AppTheme;
  ready: boolean;
  setMode(mode: ThemeMode): Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void appDependencies.getPersistence().then(({ appearancePreferences }) => appearancePreferences.getThemeMode()).then((stored) => {
      if (active) setModeState(stored);
    }).catch(() => { /* Keep System if preferences are unavailable. */ }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  }, [mode]);

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    const previous = mode;
    setModeState(nextMode);
    try {
      const { appearancePreferences } = await appDependencies.getPersistence();
      await appearancePreferences.setThemeMode(nextMode, new Date().toISOString());
    } catch (error) {
      setModeState(previous);
      throw error;
    }
  }, [mode]);

  const dark = mode === 'dark' || (mode === 'system' && systemScheme !== 'light');
  const value = useMemo(() => ({ mode, theme: createTheme(dark), ready, setMode }), [dark, mode, ready, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  useLocale(); // Locale changes refresh formatter/composition consumers as well as individual text nodes.
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme must be used inside AppThemeProvider.');
  return value;
}
