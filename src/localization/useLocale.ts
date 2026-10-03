import { useSyncExternalStore } from 'react';
import { directionForLanguage, getLanguage, subscribeLanguage } from './i18n';

/** Presentation subscription has no persistence/native dependencies. */
export function useLocale() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, () => 'en' as const);
  return { language, isRTL: language === 'ar', direction: directionForLanguage(language) };
}
