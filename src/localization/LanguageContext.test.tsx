import { createElement } from 'react';
// @ts-expect-error The installed renderer does not ship TypeScript declarations.
import { act, create } from 'react-test-renderer';
import { StyleSheet, Text as NativeText, View as NativeView, type StyleProp, type ViewStyle } from 'react-native';
import { appDependencies } from '../appDependencies';
import { LanguageProvider, setAppLanguage } from './LanguageContext';
import { Text, View } from './LocalizedNative';
import { getLanguage, publishLanguage } from './i18n';

jest.mock('../appDependencies', () => ({ appDependencies: { getPersistence: jest.fn() } }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => publishLanguage('en'));

test('relaunch hydration restores Arabic before showing content and applies real RTL styles', async () => {
  const getLanguagePreference = jest.fn().mockResolvedValue('ar');
  (appDependencies.getPersistence as jest.Mock).mockResolvedValue({ productPreferences: { getLanguage: getLanguagePreference } });
  let screen: ReturnType<typeof create>;
  try {
    await act(async () => { screen = create(createElement(LanguageProvider, null, createElement(View, null, createElement(Text, { accessibilityLabel: 'Settings' }, 'Settings')))); });
    expect(getLanguage()).toBe('ar');
    const text = screen.root.findByType(NativeText);
    expect(text.props.children).toBe('الإعدادات');
    expect(text.props.accessibilityLabel).toBe('الإعدادات');
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({ textAlign: 'right', writingDirection: 'rtl', letterSpacing: 0 });
    expect(screen.root.findAllByType(NativeView).some((node: { props: { style?: StyleProp<ViewStyle> } }) => StyleSheet.flatten(node.props.style)?.direction === 'rtl')).toBe(true);
  } finally { await act(async () => screen?.unmount()); }
});

test('language commits only after persistence succeeds; numeric unit runs stay LTR', async () => {
  const save = jest.fn().mockRejectedValueOnce(new Error('Disk unavailable')).mockResolvedValue(undefined);
  (appDependencies.getPersistence as jest.Mock).mockResolvedValue({ productPreferences: { setLanguage: save } });
  await expect(setAppLanguage('ar')).rejects.toThrow('Disk unavailable');
  expect(getLanguage()).toBe('en');
  await setAppLanguage('ar');
  let screen: ReturnType<typeof create>;
  try {
    await act(async () => { screen = create(createElement(Text, null, '56', ' bpm')); });
    expect(screen.root.findByType(NativeText).props.children).toBe('56 bpm');
    expect(StyleSheet.flatten(screen.root.findByType(NativeText).props.style).writingDirection).toBe('ltr');
    await act(async () => { await setAppLanguage('en'); });
    expect(screen.root.findByType(NativeText).props.children).toBe('56 bpm');
  } finally { await act(async () => screen?.unmount()); }
});
