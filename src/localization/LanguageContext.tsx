import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { appDependencies } from '../appDependencies';
import { publishLanguage } from './i18n';
import { useLocale as usePresentationLocale } from './useLocale';
import type { AppLanguage } from './resources';

export async function setAppLanguage(next: AppLanguage): Promise<void> {
  const { productPreferences } = await appDependencies.getPersistence();
  await productPreferences.setLanguage(next);
  publishLanguage(next);
}
export function useLocale() {
  return { ...usePresentationLocale(), setLanguage: setAppLanguage };
}
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { direction } = useLocale();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void appDependencies.getPersistence().then(({ productPreferences }) => productPreferences.getLanguage()).then((stored) => {
      if (active) publishLanguage(stored);
    }).catch(() => { /* English is the safe default if local preferences cannot be read. */ }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  return ready ? <View style={{ direction, flex: 1 }}>{children}</View> : null;
}
