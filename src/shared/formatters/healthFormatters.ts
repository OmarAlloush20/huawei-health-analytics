import { getLocale, tr } from '../../localization/i18n';

export function formatSleepDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return tr('format.duration', { hours, minutes });
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(getLocale()).format(value);
}
