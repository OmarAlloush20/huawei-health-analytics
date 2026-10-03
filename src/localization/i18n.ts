import { ar, en, messages, type AppLanguage, type TranslationKey } from './resources';

let language: AppLanguage = 'en';
const listeners = new Set<() => void>();
export function getLanguage(): AppLanguage { return language; }
export function getLocale(value: AppLanguage = language): string { return value === 'ar' ? 'ar-u-nu-latn' : 'en-US'; }
export function normalizeLanguage(value: unknown): AppLanguage { return value === 'ar' ? 'ar' : 'en'; }
export function publishLanguage(value: AppLanguage) { if (language !== value) { language = value; listeners.forEach((listener) => listener()); } }
export function subscribeLanguage(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
/** Health values and dates use Western numerals in both product languages. */
export function localizeDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/٬/g, ',').replace(/٫/g, '.');
}
export function tr(key: TranslationKey, values: Record<string, string | number> = {}, target: AppLanguage = language): string {
  return localizeDigits((target === 'ar' ? ar : en)[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`)));
}

const exact = new Map<string, TranslationKey>();
for (const [key, pair] of Object.entries(messages)) {
  for (const value of pair) for (const variant of [value, localizeDigits(value)]) if (!variant.includes('{') && !exact.has(variant)) exact.set(variant, key as TranslationKey);
}
const numericNames = /^(count|hours|minutes|available|required|expected|signals|model|applied|days|amount|weight|percent|points|low|high|center)$/;
const templates = Object.entries(en).filter(([, value]) => value.includes('{')).sort((a, b) => b[1].replace(/\{\w+\}/g, '').length - a[1].replace(/\{\w+\}/g, '').length).map(([key, value]) => {
  const names: string[] = [];
  const pattern = value.split(/(\{\w+\})/).map((part) => {
    if (/^\{\w+\}$/.test(part)) { const name = part.slice(1, -1); names.push(name); return numericNames.test(name) ? '([\\d٠-٩۰-۹.,٬٫+−\u061C\u200E\u200F-]+)' : '(.+?)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return { key: key as TranslationKey, names, pattern: new RegExp(`^${pattern}$`) };
});

/** Localizes deterministic engine copy at the presentation boundary, never edits engine outputs/rules. */
export function localizeText(value: string, target: AppLanguage = language, depth = 0): string {
  if (!value || depth > 5) return value;
  const key = exact.get(value) ?? exact.get(value.trim());
  if (key) return `${value.match(/^\s*/)?.[0] ?? ''}${tr(key, {}, target)}${value.match(/\s*$/)?.[0] ?? ''}`;
  if (target === 'en') return localizeDigits(value);
  if (value === '›' || value === '‹' || value === '↗' || value === '↖') return ({ '›': '‹', '‹': '›', '↗': '↖', '↖': '↗' })[value];
  const arrow = value.match(/^(.*?)(\s*)([›‹↗↖])$/);
  if (arrow) return `${localizeText(arrow[1], target, depth + 1)}${arrow[2]}${localizeText(arrow[3], target, depth + 1)}`;
  // Split first: a generic {metric} must never consume another complete engine sentence.
  if (value.includes('. ')) return value.split(/(?<=\.) /).map((part) => localizeText(part, target, depth + 1)).join(' ');
  for (const template of templates) {
    const match = value.match(template.pattern);
    if (match) return tr(template.key, Object.fromEntries(template.names.map((name, index) => [name, localizeText(match[index + 1], target, depth + 1)])), target);
  }
  if (value.endsWith('.')) return `${localizeText(value.slice(0, -1), target, depth + 1)}.`;
  if (value.includes(', ')) return value.split(', ').map((part) => localizeText(part, target, depth + 1)).join('، ');
  return localizeDigits(value);
}

export function directionForLanguage(value: AppLanguage): 'ltr' | 'rtl' { return value === 'ar' ? 'rtl' : 'ltr'; }
export function isNumericLabel(value: string): boolean {
  return /^[\d٠-٩.,٬٫%+−–—\u061C\u200E\u200F\-/:\s]+(?:ms(?: RMSSD)?|bpm|kcal|km|pts|min)?$/.test(value.trim());
}
