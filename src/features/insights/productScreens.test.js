import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { Alert, AppState, StyleSheet, Switch, Text } from 'react-native';
import { Pressable, View } from '../../localization/LocalizedNative';

import { router } from 'expo-router';
import { appDependencies } from '../../appDependencies';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, MOCK_HEALTH_SCENARIOS } from '../../providers/mock/mockHealthData';
import { generateInsights } from '../../services/insightsEngine';
import { buildTrendReport } from '../../services/trendEngine';
import { DeveloperToolsScreen } from '../development/DeveloperToolsScreen';
import { NotificationSettingsScreen } from '../notifications/NotificationSettingsScreen';
import { InsightsScreen } from './InsightsScreen';
import { getLanguage, getLocale, publishLanguage, tr } from '../../localization/i18n';

const mockSetMode = jest.fn();
let mockDark = false;
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: (effect) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null, DateTimePickerAndroid: { open: jest.fn() } }));
jest.mock('../../appDependencies', () => ({ appDependencies: { getPersistence: jest.fn(), healthProvider: { id: 'mock' } } }));
jest.mock('../../theme/ThemeContext', () => ({ useAppTheme: () => ({ theme: jest.requireActual('../../theme/theme').createTheme(mockDark), mode: 'system', setMode: mockSetMode }) }));
jest.mock('../../components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('../../components/SignalVisuals', () => ({ Sparkline: () => null }));
jest.mock('../../components/ProductUI', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  return {
    Reveal: ({ children }) => React.createElement(View, null, children),
    SectionLabel: ({ title }) => React.createElement(Text, null, title),
    CompactState: ({ title, message }) => React.createElement(Text, null, `${title}. ${message ?? ''}`),
    ProductSheet: ({ visible, title, children }) => visible ? React.createElement(View, { testID: `sheet-${title}` }, children) : null,
  };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let screen;
let services;
let dimensions;
let appStateSubscription;
const stats = { storedDays: 90, lastDate: MOCK_ANCHOR_DATE, sync: { range: { timeZone: MOCK_TIME_ZONE } } };
const snapshot = { permission: 'granted', preferences: { enabled: true, dailyReminderEnabled: true, reminderTime: { hour: 9, minute: 0 } } };
const scenarios = { current: 'balanced', options: MOCK_HEALTH_SCENARIOS };
const mockData = createMockHealthData('high-activity', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
if (mockData.dailySummaries.status !== 'available') throw new Error('Expected mock history');
const reports = Object.fromEntries(['7d', '30d', '90d'].map((range) => [range, buildTrendReport(range, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, mockData.dailySummaries.value)]));

beforeEach(() => {
  jest.clearAllMocks();
  mockDark = false;
  mockSetMode.mockResolvedValue(undefined);
  services = {
    productPreferences: { setLanguage: jest.fn().mockResolvedValue(undefined), getLanguage: jest.fn().mockResolvedValue('en') },
    dashboardService: {
      getStats: jest.fn().mockResolvedValue(stats),
      bootstrapDevelopmentDataIfEmpty: jest.fn().mockResolvedValue(stats),
      getDevelopmentScenarios: jest.fn().mockReturnValue(scenarios),
      selectDevelopmentScenario: jest.fn().mockResolvedValue(stats),
    },
    trendsService: { getReport: jest.fn(async (range) => reports[range]) },
    insightsService: { getInsights: jest.fn(async (range) => generateInsights(reports[range])) },
    notificationSettingsService: {
      getSettings: jest.fn().mockResolvedValue(snapshot),
      setDailyReminderEnabled: jest.fn().mockResolvedValue(snapshot),
    },
  };
  appDependencies.getPersistence.mockResolvedValue(services);
  dimensions = jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  appStateSubscription = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});

afterEach(async () => { if (screen) await act(async () => screen.unmount()); screen = null; publishLanguage('en'); dimensions.mockRestore(); appStateSubscription.mockRestore(); appDependencies.healthProvider.id = 'mock'; delete appDependencies.healthProvider.getIntegrationState; });
async function mount(Component) { await act(async () => { screen = TestRenderer.create(React.createElement(Component)); }); }
function interactive(label) { return screen.root.findAll((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0]; }
function flattenText(children) {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(flattenText).join('');
  return children?.props ? flattenText(children.props.children) : '';
}
function textContent() { return screen.root.findAllByType(Text).map((node) => flattenText(node.props.children)).join(' '); }

test('weekly summary uses the seven-day report after selecting 30 days and drills to the correct metric/date', async () => {
  await mount(InsightsScreen);
  await act(async () => interactive('30 day period').props.onPress());
  expect(services.trendsService.getReport).toHaveBeenCalledWith('30d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
  expect(services.trendsService.getReport).toHaveBeenCalledWith('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
  await act(async () => interactive('Open weekly summary').props.onPress());
  expect(screen.root.findAllByProps({ testID: 'sheet-Weekly summary' }).length).toBeGreaterThan(0);
  expect(textContent()).toContain('Average Recovery');
  expect(textContent()).toContain('Average Sleep');
  const stepObservation = generateInsights(reports['7d']).insights.find((insight) => insight.metric === 'steps');
  expect(stepObservation).toBeDefined();
  const matching = screen.root.findAll((node) => typeof node.props.onPress === 'function' && node.props.accessibilityLabel?.includes(stepObservation.title));
  await act(async () => matching.at(-1).props.onPress());
  expect(router.push).toHaveBeenCalledWith({ pathname: '/metric/[metric]', params: { metric: 'activity', date: MOCK_ANCHOR_DATE } });
}, 15000);

test('theme opens a sheet, saves the selected mode and closes it', async () => {
  await mount(NotificationSettingsScreen);
  await act(async () => interactive('Theme, System').props.onPress());
  expect(screen.root.findAllByProps({ testID: 'sheet-Appearance' }).length).toBeGreaterThan(0);
  const radio = screen.root.findAllByType(Pressable).filter((node) => node.props.accessibilityRole === 'radio' && typeof node.props.onPress === 'function');
  await act(async () => radio[2].props.onPress());
  expect(mockSetMode).toHaveBeenCalledWith('light');
  expect(screen.root.findAllByProps({ testID: 'sheet-Appearance' })).toHaveLength(0);
});

test('language selector persists Arabic, updates the app and returns to English without notification mutations', async () => {
  await mount(NotificationSettingsScreen);
  await act(async () => interactive('Language, English').props.onPress());
  await act(async () => interactive('العربية').props.onPress());
  expect(services.productPreferences.setLanguage).toHaveBeenCalledWith('ar');
  expect(getLanguage()).toBe('ar');
  expect(textContent()).toContain('الإعدادات');
  expect(services.notificationSettingsService.setDailyReminderEnabled).not.toHaveBeenCalled();
  await act(async () => interactive('اللغة, العربية').props.onPress());
  await act(async () => interactive('English').props.onPress());
  expect(services.productPreferences.setLanguage).toHaveBeenLastCalledWith('en');
  expect(textContent()).toContain('Settings');
});

test('a failed language save leaves the previous language active and shows a translated error', async () => {
  services.productPreferences.setLanguage.mockRejectedValue(new Error('Disk unavailable'));
  await mount(NotificationSettingsScreen);
  await act(async () => interactive('Language, English').props.onPress());
  await act(async () => interactive('العربية').props.onPress());
  expect(getLanguage()).toBe('en');
  expect(textContent()).toContain('Language preference could not be saved.');
});

test('Arabic Insights snapshot and deterministic observations contain no English prose', async () => {
  publishLanguage('ar');
  await mount(InsightsScreen);
  expect(textContent()).toContain(tr('format.snapshot', { count: 7 }));
  expect(textContent()).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
  expect(textContent().replace(/HRV|RHR|SpO₂|RMSSD|ms|bpm|kcal|steps/g, '')).not.toMatch(/[A-Za-z]/);
  await act(async () => interactive(tr('insights.openWeekly')).props.onPress());
  expect(textContent()).toContain(tr('insights.averageRecovery'));
});

test('daily reminder remains disabled when system permission is denied', async () => {
  services.notificationSettingsService.getSettings.mockResolvedValue({ ...snapshot, permission: 'denied' });
  await mount(NotificationSettingsScreen);
  const switches = screen.root.findAll((node) => node.props.accessibilityLabel === 'Daily reminder enabled' && typeof node.props.onValueChange === 'function');
  expect(switches[0].props.disabled).toBe(true);
  expect(services.notificationSettingsService.setDailyReminderEnabled).not.toHaveBeenCalled();
});

test('a settings read started before a notification toggle cannot revert the saved value', async () => {
  let foreground;
  const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, callback) => {
    foreground = callback;
    return { remove: jest.fn() };
  });
  try {
    await mount(NotificationSettingsScreen);
    let resolveOldSettings;
    const oldSettings = new Promise((resolve) => { resolveOldSettings = resolve; });
    services.notificationSettingsService.getSettings.mockReturnValue(oldSettings);
    await act(async () => foreground('active'));
    const saved = { ...snapshot, preferences: { ...snapshot.preferences, enabled: false } };
    services.notificationSettingsService.setEnabled = jest.fn().mockResolvedValue(saved);
    const notificationSwitch = () => screen.root.findAll((node) => node.props.accessibilityLabel === 'Notifications enabled' && typeof node.props.onValueChange === 'function')[0];
    await act(async () => notificationSwitch().props.onValueChange(false));
    expect(services.notificationSettingsService.setEnabled).toHaveBeenCalledWith(false);
    await act(async () => resolveOldSettings(snapshot));
    expect(notificationSwitch().props.value).toBe(false);
  } finally { subscription.mockRestore(); }
});

test('scenario selection delegates the chosen fixture and refreshes its checkmark', async () => {
  await mount(DeveloperToolsScreen);
  services.dashboardService.getDevelopmentScenarios.mockReturnValue({ ...scenarios, current: 'poor-sleep' });
  const row = interactive('Poor Sleep. A recent week of shorter, later sleep.');
  await act(async () => row.props.onPress());
  expect(services.dashboardService.selectDevelopmentScenario).toHaveBeenCalledWith('poor-sleep');
  expect(interactive('Poor Sleep. A recent week of shorter, later sleep.').props.accessibilityState.checked).toBe(true);
});

test('refresh failure keeps the last snapshot visible', async () => {
  await mount(InsightsScreen);
  services.trendsService.getReport.mockRejectedValue(new Error('Offline'));
  const refresh = screen.root.findAll((node) => typeof node.props.onRefresh === 'function')[0];
  await act(async () => refresh.props.onRefresh());
  expect(textContent()).toContain('7-day snapshot');
  expect(textContent()).toContain('Couldn’t refresh');
});

test('a slower period request cannot replace a more recently selected period', async () => {
  await mount(InsightsScreen);
  let resolveSlow;
  const slow = new Promise((resolve) => { resolveSlow = resolve; });
  services.trendsService.getReport.mockImplementation((range) => range === '30d' ? slow : Promise.resolve(reports[range]));
  await act(async () => interactive('30 day period').props.onPress());
  await act(async () => interactive('90 day period').props.onPress());
  await act(async () => resolveSlow(reports['30d']));
  expect(textContent()).toContain('90-day snapshot');
  expect(textContent()).not.toContain('30-day snapshot');
});

test.each([
  ['recovery', 'recovery'],
  ['sleep-duration', 'sleep'],
  ['hrv-rmssd', 'hrv'],
  ['resting-heart-rate', 'rhr'],
  ['steps', 'activity'],
])('every known %s observation opens its own detail on the observation date', async (metric, destination) => {
  const result = generateInsights(reports['7d']);
  const insight = { ...result.insights[0], ruleId: `jump-${metric}`, metric, title: `Inspect ${metric}`, endDate: '2026-09-24' };
  services.insightsService.getInsights.mockResolvedValue({ ...result, insights: [insight] });
  await mount(InsightsScreen);
  const row = screen.root.findAllByType(Pressable).find((node) => node.props.accessibilityLabel?.includes(insight.title));
  expect(row).toBeDefined();
  expect(textContent()).toContain('View details');
  await act(async () => row.props.onPress());
  expect(router.push).toHaveBeenCalledWith({ pathname: '/metric/[metric]', params: { metric: destination, date: insight.endDate } });
});

test('a weekly snapshot shortcut closes the sheet before opening the matching detail', async () => {
  await mount(InsightsScreen);
  await act(async () => interactive('Open weekly summary').props.onPress());
  const sheet = screen.root.findAllByProps({ testID: 'sheet-Weekly summary' })[0];
  const recovery = sheet.findAllByType(Pressable).find((node) => node.props.accessibilityLabel?.startsWith('Recovery,'));
  await act(async () => recovery.props.onPress());
  expect(screen.root.findAllByProps({ testID: 'sheet-Weekly summary' })).toHaveLength(0);
  expect(router.push).toHaveBeenCalledWith({ pathname: '/metric/[metric]', params: { metric: 'recovery', date: MOCK_ANCHOR_DATE } });
});

test('tabbed screens leave the bottom inset to the tab bar; Developer Tools owns all edges', async () => {
  for (const Component of [InsightsScreen, NotificationSettingsScreen, DeveloperToolsScreen]) {
    await mount(Component);
    const safeArea = screen.root.findAll((node) => Array.isArray(node.props.edges))[0];
    expect(safeArea.props.edges).toEqual(Component === DeveloperToolsScreen ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']);
    await act(async () => screen.unmount());
    screen = null;
  }
});

test.each([360, 390, 412, 480])('Settings reflows provider text without shrinking switch hit areas at %sdp in English and Arabic', async (width) => {
  for (const language of ['en', 'ar']) {
    for (const fontScale of [1, 1.5]) {
      publishLanguage(language);
      dimensions.mockReturnValue({ width, height: 844, scale: 1, fontScale });
      await mount(NotificationSettingsScreen);
      const authorizationRow = screen.root.findAll((node) => node.type.name === 'SettingsRow' && node.props.label === tr('settings.authorization'))[0];
      const rowStyle = StyleSheet.flatten(authorizationRow.findAllByType(View)[0].props.style);
      expect(rowStyle.flexDirection).toBe(width < 390 || fontScale > 1.15 ? 'column' : 'row');
      const legalRow = screen.root.findAll((node) => node.type.name === 'SettingsRow' && node.props.label === tr('settings.privacy'))[0];
      expect(StyleSheet.flatten(legalRow.findAllByType(Pressable)[0].props.style({ pressed: false })).flexDirection).toBe('row');
      for (const toggle of screen.root.findAllByType(Switch)) {
        const style = StyleSheet.flatten(toggle.props.style);
        expect(style.minHeight).toBeGreaterThanOrEqual(48);
        expect(style.minWidth).toBeGreaterThanOrEqual(48);
      }
      expect(textContent()).toContain(tr('settings.authorization'));
      await act(async () => screen.unmount());
      screen = null;
    }
  }
});

test.each([360, 390, 412, 480])('Insights keeps its values readable and gives compact/enlarged copy the full width at %sdp', async (width) => {
  for (const language of ['en', 'ar']) {
    for (const fontScale of [1, 1.5]) {
      publishLanguage(language);
      dimensions.mockReturnValue({ width, height: 844, scale: 1, fontScale });
      await mount(InsightsScreen);
      const observation = screen.root.findAll((node) => node.type.name === 'Observation')[0];
      const main = observation.findAllByType(View).find((node) => StyleSheet.flatten(node.props.style)?.marginTop === 10);
      expect(StyleSheet.flatten(main.props.style).flexDirection).toBe(fontScale > 1.15 ? 'column' : 'row');
      const sparks = observation.findAll((node) => node.type.name === 'Sparkline');
      expect(sparks.length).toBe(width < 390 || fontScale > 1.15 ? 0 : 1);
      expect(screen.root.findAllByType(Text).every((node) => node.props.numberOfLines === undefined)).toBe(true);
      await act(async () => screen.unmount());
      screen = null;
    }
  }
});

test('deleting health data remains an explicit native confirmation and cancellation never mutates data', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  services.repository = { deleteAllLocalHealthData: jest.fn().mockResolvedValue(undefined) };
  try {
    await mount(NotificationSettingsScreen);
    await act(async () => interactive(tr('settings.delete')).props.onPress());
    expect(alert).toHaveBeenCalledWith(tr('settings.deleteTitle'), tr('settings.deleteHelp'), expect.any(Array));
    expect(services.repository.deleteAllLocalHealthData).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2];
    expect(buttons[0]).toEqual({ text: tr('common.cancel'), style: 'cancel' });
    await act(async () => buttons[1].onPress());
    expect(services.repository.deleteAllLocalHealthData).toHaveBeenCalledTimes(1);
  } finally { alert.mockRestore(); }
});

test.each([360, 390, 412, 480])('premium recap retains every aggregate in two tiers and reflows for enlarged text at %sdp', async (width) => {
  for (const dark of [true, false]) {
    mockDark = dark;
    for (const language of ['en', 'ar']) {
      publishLanguage(language);
      for (const fontScale of [1, 1.5]) {
        dimensions.mockReturnValue({ width, height: 844, scale: 1, fontScale });
        await mount(InsightsScreen);
        const recap = screen.root.findAllByProps({ testID: 'insights-recap' })[0];
        const featured = screen.root.findAllByProps({ testID: 'insights-featured-recap' })[0];
        const signals = screen.root.findAllByProps({ testID: 'insights-signal-recap' })[0];
        expect(StyleSheet.flatten(featured.props.style).flexDirection).toBe(fontScale > 1.15 ? 'column' : 'row');
        expect(StyleSheet.flatten(signals.props.style).flexDirection).toBe(fontScale > 1.15 ? 'column' : 'row');
        expect(recap.findAllByType(Pressable)).toHaveLength(5);
        expect(featured.findAllByType(Pressable)).toHaveLength(2);
        expect(signals.findAllByType(Pressable)).toHaveLength(3);
        const colors = jest.requireActual('../../theme/theme').createTheme(dark).colors;
        expect(StyleSheet.flatten(recap.props.style).backgroundColor).toBe(colors.surface);
        expect(StyleSheet.flatten(recap.props.style).backgroundColor.toLowerCase()).not.toBe('#ffffff');
        for (const reading of recap.findAllByType(Pressable)) {
          expect(StyleSheet.flatten(reading.props.style({ pressed: false })).minHeight).toBeGreaterThanOrEqual(48);
        }
        expect(textContent()).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
        await act(async () => screen.unmount());
        screen = null;
      }
    }
  }
});

test('source status shows actual last successful sync and a friendly failed-refresh label, never raw errors', async () => {
  publishLanguage('ar');
  const lastSuccessfulAt = '2026-09-30T11:20:00Z';
  services.dashboardService.getStats.mockResolvedValue({ ...stats, sync: { ...stats.sync, lastSuccessfulAt, status: 'failed', error: 'Raw private bridge error' } });
  await mount(NotificationSettingsScreen);
  expect(textContent()).toContain(tr('settings.mockSourceHelp'));
  expect(textContent()).toContain(tr('state.refreshFailed'));
  const date = new Intl.DateTimeFormat(getLocale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(lastSuccessfulAt));
  expect(textContent()).toContain(date);
  expect(textContent()).not.toContain('Raw private bridge error');
  expect(textContent()).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
});

test('Huawei source clearly describes step-only scope without adding integration actions', async () => {
  appDependencies.healthProvider.id = 'huawei';
  appDependencies.healthProvider.getIntegrationState = jest.fn(() => ({ userAuthorization: 'not-performed' }));
  services.dashboardService.getDevelopmentScenarios.mockReturnValue(null);
  await mount(NotificationSettingsScreen);
  expect(textContent()).toContain('Huawei Health');
  expect(textContent()).toContain(tr('settings.huaweiSourceHelp'));
  expect(textContent()).toContain(tr('authorization.notRequested'));
  expect(textContent()).not.toContain(tr('dev.tools'));
  expect(services.notificationSettingsService.setDailyReminderEnabled).not.toHaveBeenCalled();
});

test('developer scenario list stays compact, selected-only explanatory copy and all full radio labels', async () => {
  await mount(DeveloperToolsScreen);
  expect(textContent()).toContain(tr('dev.buildLabel'));
  const rows = screen.root.findAllByType(Pressable).filter((node) => node.props.accessibilityRole === 'radio');
  expect(rows).toHaveLength(6);
  for (const row of rows) {
    expect(StyleSheet.flatten(row.props.style({ pressed: false })).minHeight).toBeGreaterThanOrEqual(48);
    expect(row.props.accessibilityLabel).toMatch(/\..+\./);
  }
  expect(textContent()).toContain(tr('dev.balancedHelp'));
  expect(textContent()).not.toContain(tr('dev.sleepHelp'));
});

test('an unavailable recap reading stays quiet and accessible without a fabricated zero or unit', async () => {
  const series = reports['7d'].series['hrv-rmssd'];
  const report = { ...reports['7d'], series: { ...reports['7d'].series, 'hrv-rmssd': { ...series, availableDays: 0, coveragePercent: 0, points: series.points.map((point) => ({ ...point, status: 'unsupported', value: undefined })), comparison: { direction: 'insufficient-data', material: false } } } };
  services.trendsService.getReport.mockResolvedValue(report);
  services.insightsService.getInsights.mockResolvedValue({ ...generateInsights(report), insights: [] });
  await mount(InsightsScreen);
  const recap = screen.root.findAllByProps({ testID: 'insights-recap' })[0];
  const hrv = recap.findAllByType(Pressable).find((node) => node.props.accessibilityLabel.startsWith(tr('metric.hrvFull')));
  expect(hrv.props.accessibilityLabel).toContain(tr('common.noData'));
  expect(hrv.props.accessibilityLabel).not.toContain(' ms');
  const copy = hrv.findAllByType(Text).map((node) => flattenText(node.props.children)).join(' ');
  expect(copy).toContain(tr('common.noData'));
  expect(copy).toContain(tr('format.compactCoverage', { available: 0, expected: 7 }));
  await act(async () => hrv.props.onPress());
  expect(router.push).toHaveBeenCalledWith({ pathname: '/metric/[metric]', params: { metric: 'hrv', date: MOCK_ANCHOR_DATE } });
});
