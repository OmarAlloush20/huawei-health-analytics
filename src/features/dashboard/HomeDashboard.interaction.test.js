import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

import { router } from 'expo-router';
import { appDependencies } from '../../appDependencies';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../../providers/mock/mockHealthData';
import { buildTrendReport } from '../../services/trendEngine';
import { HomeDashboard } from './HomeDashboard';
import { getLocale, publishLanguage, tr } from '../../localization/i18n';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

let mockDarkTheme = true;

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('../../appDependencies', () => ({ appDependencies: { getPersistence: jest.fn(), healthProvider: { id: 'mock', displayName: 'Mock data' } } }));
jest.mock('../../theme/ThemeContext', () => ({ useAppTheme: () => ({ theme: jest.requireActual('../../theme/theme').createTheme(mockDarkTheme) }) }));
jest.mock('../../components/AppIcon', () => ({ AppIcon: () => null, BrandMark: () => null }));
jest.mock('../../components/SignalVisuals', () => ({ MovementBars: () => null, RecoveryGauge: () => null, SleepComposition: () => null, Sparkline: () => null }));
jest.mock('../../components/ProductUI', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    Reveal: ({ children }) => React.createElement(View, null, children),
    SectionLabel: ({ title, action, onAction }) => React.createElement(View, null, React.createElement(Text, null, title), action ? React.createElement(Pressable, { onPress: onAction }, React.createElement(Text, null, action)) : null),
    CompactState: ({ title, message }) => React.createElement(Text, null, `${title}. ${message ?? ''}`),
    ProductSheet: ({ visible, title, children }) => visible ? React.createElement(View, { testID: `sheet-${title}` }, children) : null,
  };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const fixtures = createMockHealthData('balanced', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
if (fixtures.dailySummaries.status !== 'available') throw new Error('Expected mock history');
const history = fixtures.dailySummaries.value;
const stats = { provider: 'mock', storedDays: history.length, firstDate: '2026-07-03', lastDate: MOCK_ANCHOR_DATE, sync: { range: { timeZone: MOCK_TIME_ZONE } } };
const dayData = (date) => ({ summary: history.find((day) => day.date === date), baselines: null, recovery: null, insight: null });
const weekReports = new Map();
let services;
let screen;

beforeEach(() => {
  jest.clearAllMocks();
  services = {
    dashboardService: {
      getStats: jest.fn().mockResolvedValue(stats),
      bootstrapDevelopmentDataIfEmpty: jest.fn().mockResolvedValue(stats),
      readDay: jest.fn(async (date) => dayData(date)),
      refresh: jest.fn().mockResolvedValue(stats),
    },
    repository: { getDailySummaries: jest.fn(async (_provider, range) => history.filter((day) => day.date >= range.start && day.date <= range.end)) },
    trendsService: { getReport: jest.fn(async (_range, date) => {
      if (!weekReports.has(date)) weekReports.set(date, buildTrendReport('7d', date, MOCK_TIME_ZONE, history));
      return weekReports.get(date);
    }) },
    productPreferences: { getFocusMetrics: jest.fn().mockResolvedValue(['hrv']), setFocusMetrics: jest.fn().mockResolvedValue(undefined) },
  };
  appDependencies.getPersistence.mockResolvedValue(services);
});

afterEach(async () => { if (screen) await act(async () => screen.unmount()); screen = null; mockDarkTheme = true; publishLanguage('en'); });
async function mount() { await act(async () => { screen = TestRenderer.create(React.createElement(HomeDashboard)); }); }
function buttons() {
  const seen = new Set();
  return screen.root.findAll((node) => typeof node.props.onPress === 'function').filter((node) => {
    if (seen.has(node.props.onPress)) return false;
    seen.add(node.props.onPress);
    return true;
  });
}
function pressable(label) { return buttons().find((node) => node.props.accessibilityLabel === label); }
function pressableWithText(value, role) { return buttons().find((node) => (!role || node.props.accessibilityRole === role) && node.findAll((text) => text.props.children === value).length); }
function dateButton() { return buttons().find((node) => node.props.accessibilityLabel?.endsWith('. Open calendar')); }
function recoveryButton() { return buttons().find((node) => node.props.accessibilityLabel?.endsWith('. View details')); }
async function chooseDate(date) {
  await act(async () => dateButton().props.onPress());
  const monthPicker = buttons().find((node) => node.props.accessibilityLabel?.endsWith('. Choose month'));
  await act(async () => monthPicker.props.onPress());
  await act(async () => pressableWithText('Sep 2026').props.onPress());
  const day = pressable(`${new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}, recorded day`);
  expect(day.props.disabled).toBe(false);
  await act(async () => day.props.onPress());
}
function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

test('stale refresh initialization cannot launch a read that replaces a newer calendar selection', async () => {
  await mount();
  const oldStats = deferred();
  const selectedDay = deferred();
  services.dashboardService.getStats.mockReturnValue(oldStats.promise);
  const refresh = screen.root.findAll((node) => typeof node.props.onRefresh === 'function')[0];
  await act(async () => refresh.props.onRefresh());
  expect(services.dashboardService.getStats).toHaveBeenCalledTimes(2);
  services.dashboardService.readDay.mockImplementation((date) => date === '2026-09-28' ? selectedDay.promise : Promise.resolve(dayData(date)));
  await chooseDate('2026-09-28');
  await act(async () => oldStats.resolve(stats));
  expect(services.dashboardService.readDay.mock.calls.filter(([date]) => date === MOCK_ANCHOR_DATE)).toHaveLength(1);
  await act(async () => selectedDay.resolve(dayData('2026-09-28')));
  expect(dateButton().props.accessibilityLabel).toBe('2026-09-28. Open calendar');
  await act(async () => recoveryButton().props.onPress());
  expect(router.push).toHaveBeenCalledWith({ pathname: '/metric/[metric]', params: { metric: 'recovery', date: '2026-09-28' } });
}, 15000);

test('a slower historical response cannot replace the most recently selected day', async () => {
  await mount();
  const older = deferred();
  services.dashboardService.readDay.mockImplementation((date) => date === '2026-09-29' ? older.promise : Promise.resolve(dayData(date)));
  await chooseDate('2026-09-29');
  await chooseDate('2026-09-27');
  await act(async () => older.resolve(dayData('2026-09-29')));
  expect(dateButton().props.accessibilityLabel).toBe('2026-09-27. Open calendar');
  await act(async () => recoveryButton().props.onPress());
  expect(router.push).toHaveBeenCalledWith({ pathname: '/metric/[metric]', params: { metric: 'recovery', date: '2026-09-27' } });
});

test('Customize Today persists chosen readings and clearing them leaves Recovery accessible', async () => {
  await mount();
  await act(async () => pressable('Customize Today').props.onPress());
  const checkboxes = buttons().filter((node) => node.props.accessibilityRole === 'checkbox');
  expect(checkboxes).toHaveLength(6);
  expect(pressableWithText('Recovery', 'checkbox')).toBeUndefined();
  await act(async () => pressableWithText('Resting heart rate', 'checkbox').props.onPress());
  await act(async () => pressableWithText('Save Today').props.onPress());
  expect(services.productPreferences.setFocusMetrics).toHaveBeenLastCalledWith(['hrv', 'rhr']);
  expect(screen.root.findAllByProps({ testID: 'sheet-Customize Today' })).toHaveLength(0);
  await act(async () => pressable('Customize Today').props.onPress());
  await act(async () => pressableWithText('Heart rate variability', 'checkbox').props.onPress());
  await act(async () => pressableWithText('Resting heart rate', 'checkbox').props.onPress());
  await act(async () => pressableWithText('Save Today').props.onPress());
  expect(services.productPreferences.setFocusMetrics).toHaveBeenLastCalledWith([]);
  expect(recoveryButton()).toBeDefined();
});

test('recorded calendar day updates the metric drilldown anchor', async () => {
  await mount();
  await chooseDate('2026-09-24');
  expect(services.dashboardService.readDay).toHaveBeenLastCalledWith('2026-09-24', MOCK_TIME_ZONE);
  expect(screen.root.findAllByProps({ testID: 'sheet-Your history' })).toHaveLength(0);
  await act(async () => pressableWithText('Activity').props.onPress());
  expect(router.push).toHaveBeenCalledWith({ pathname: '/metric/[metric]', params: { metric: 'activity', date: '2026-09-24' } });
});

test('focus controls cannot silently edit a draft during an in-flight save', async () => {
  const saving = deferred();
  services.productPreferences.setFocusMetrics.mockReturnValue(saving.promise);
  await mount();
  await act(async () => pressable('Customize Today').props.onPress());
  await act(async () => pressableWithText('Save Today').props.onPress());
  const options = buttons().filter((node) => node.props.accessibilityRole === 'checkbox');
  expect(options).toHaveLength(6);
  expect(options.every((node) => node.props.disabled && node.props.accessibilityState.disabled)).toBe(true);
  await act(async () => saving.resolve(undefined));
  expect(screen.root.findAllByProps({ testID: 'sheet-Customize Today' })).toHaveLength(0);
});

test('screen-reader signal and focus labels keep the actual numeric unit', async () => {
  await mount();
  for (const [name, unit] of [['metric.hrvFull', 'ms'], ['metric.rhrFull', 'bpm'], ['metric.oxygen', '%'], ['metric.stress', '/ 100']]) {
    const labels = buttons().filter((node) => node.props.accessibilityLabel?.startsWith(`${tr(name)},`));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((node) => node.props.accessibilityLabel.includes(unit))).toBe(true);
  }
});

test('an empty weekly snapshot never decorates missing values with numeric units', async () => {
  services.trendsService.getReport.mockResolvedValue(buildTrendReport('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, []));
  await mount();
  await act(async () => pressableWithText(tr('today.week')).props.onPress());
  const sheet = screen.root.findByProps({ testID: `sheet-${tr('today.week')}` });
  const values = sheet.findAllByType(Text).map((node) => Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children).join(' ');
  expect(values).toContain(tr('common.noUsableData'));
  expect(values).not.toMatch(/No usable data\s*(ms|bpm|\/\s*100|steps|min)/);
});

test('Arabic Today and calendar have local copy and preserve ISO-date navigation', async () => {
  publishLanguage('ar');
  await mount();
  const copy = screen.root.findAllByType(Text).map((node) => Array.isArray(node.props.children) ? node.props.children.filter((child) => typeof child === 'string').join('') : node.props.children).join(' ');
  expect(copy).toContain(tr('today.signals'));
  expect(copy.replace(/Huawei|Health|Analytics|HRV|RHR|SpO₂|RMSSD|ms|bpm|kcal|min/g, '')).not.toMatch(/[A-Za-z]/);
  await act(async () => buttons().find((node) => node.props.accessibilityLabel?.endsWith('فتح التقويم')).props.onPress());
  await act(async () => buttons().find((node) => node.props.accessibilityLabel?.endsWith('اختر الشهر')).props.onPress());
  const september = new Intl.DateTimeFormat(getLocale(), { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date('2026-09-15T12:00:00Z'));
  await act(async () => pressableWithText(september).props.onPress());
  const expectedDate = new Intl.DateTimeFormat(getLocale(), { dateStyle: 'full', timeZone: 'UTC' }).format(new Date('2026-09-29T12:00:00Z'));
  const recordedDay = buttons().find((node) => node.props.accessibilityLabel?.includes(expectedDate) && node.props.accessibilityLabel?.includes(tr('calendar.recorded')));
  expect(recordedDay).toBeDefined();
  await act(async () => recordedDay.props.onPress());
  expect(services.dashboardService.readDay).toHaveBeenLastCalledWith('2026-09-29', MOCK_TIME_ZONE);
});

test.each(['en', 'ar'])('%s date controls are centered, inset from content edges, and move recorded dates semantically', async (language) => {
  publishLanguage(language);
  await mount();
  const row = screen.root.findAllByType(View).find((node) => node.props.testID === 'date-navigation');
  expect(StyleSheet.flatten(row.props.style)).toMatchObject({ direction: language === 'ar' ? 'rtl' : 'ltr', paddingHorizontal: 8, gap: 8 });
  const previous = pressable(tr('calendar.previousDay'));
  const next = pressable(tr('calendar.nextDay'));
  expect(previous.findAllByType(Text)[0].props.children).toBe(language === 'ar' ? '›' : '‹');
  expect(next.findAllByType(Text)[0].props.children).toBe(language === 'ar' ? '‹' : '›');
  expect(next.props.disabled).toBe(true);
  await act(async () => previous.props.onPress());
  expect(services.dashboardService.readDay).toHaveBeenLastCalledWith('2026-09-29', MOCK_TIME_ZONE);
  await act(async () => pressable(tr('calendar.nextDay')).props.onPress());
  expect(services.dashboardService.readDay).toHaveBeenLastCalledWith(MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
});

test('focus readings visibly link straight to that metric and selected history day', async () => {
  await mount();
  await chooseDate('2026-09-24');
  const shortcut = buttons().find((node) => node.props.accessibilityHint === tr('today.focusShortcut'));
  expect(shortcut).toBeDefined();
  await act(async () => shortcut.props.onPress());
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/metric/[metric]', params: { metric: 'hrv', date: '2026-09-24' } });
});

test.each(['mock', 'huawei'])('%s freshness sheet explains source, last successful sync, scope and refresh availability without raw errors', async (provider) => {
  appDependencies.healthProvider.id = provider;
  appDependencies.healthProvider.displayName = provider === 'huawei' ? 'Huawei Health' : 'Mock data';
  const lastSuccessfulAt = '2026-09-30T10:00:00.000Z';
  services.dashboardService.getStats.mockResolvedValue({ ...stats, provider, sync: { ...stats.sync, status: 'failed', lastSuccessfulAt, error: 'PRIVATE_NATIVE_CODE - raw native stack' } });
  services.dashboardService.bootstrapDevelopmentDataIfEmpty.mockImplementation(async (next) => next);
  try {
    await mount();
    await act(async () => pressable(tr('today.freshness')).props.onPress());
    const sheet = screen.root.findByProps({ testID: `sheet-${tr('today.data')}` });
    const copy = sheet.findAllByType(Text).map((node) => node.props.children).join(' ');
    expect(copy).toContain(tr(provider === 'mock' ? 'today.mockDisclosure' : 'today.huaweiStepOnly'));
    expect(copy).toContain(tr('today.refreshAvailable'));
    expect(copy).toContain('Last sync');
    expect(copy).not.toContain('PRIVATE_NATIVE_CODE');
    await act(async () => pressableWithText(tr('today.syncNow')).props.onPress());
    expect(services.dashboardService.refresh).toHaveBeenCalledWith(MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
  } finally { appDependencies.healthProvider.id = 'mock'; appDependencies.healthProvider.displayName = 'Mock data'; }
});

test('freshness disables a duplicate refresh when a sync is running', async () => {
  services.dashboardService.getStats.mockResolvedValue({ ...stats, sync: { ...stats.sync, status: 'running' } });
  services.dashboardService.bootstrapDevelopmentDataIfEmpty.mockImplementation(async (next) => next);
  await mount();
  await act(async () => pressable(tr('today.freshness')).props.onPress());
  expect(pressableWithText(tr('today.syncNow')).props.disabled).toBe(true);
  expect(screen.root.findAllByType(Text).map((node) => node.props.children).join(' ')).toContain(tr('today.refreshBusy'));
});

test.each([true, false].flatMap((dark) => ['en', 'ar'].flatMap((language) => [[360, 1], [390, 1], [412, 1], [768, 1], [360, 2]].map(([width, fontScale]) => [dark, language, width, fontScale]))))('Today (dark=%s) %s at %idp/%sx owns side insets and keeps full values', async (dark, language, width, fontScale) => {
  const dimensions = jest.spyOn(jest.requireActual('react-native'), 'useWindowDimensions').mockReturnValue({ width, height: 844, scale: 1, fontScale });
  mockDarkTheme = dark;
  publishLanguage(language);
  try {
    await mount();
    expect(screen.root.findByType(SafeAreaView).props.edges).toEqual(['top', 'left', 'right']);
    const texts = screen.root.findAllByType(Text);
    expect(texts.every((node) => node.props.numberOfLines === undefined)).toBe(true);
    const copy = texts.map((node) => Array.isArray(node.props.children) ? node.props.children.filter((value) => typeof value === 'string' || typeof value === 'number').join('') : node.props.children).join(' ');
    expect(copy).not.toMatch(/[٠-٩۰-۹٬٫]/);
    expect(copy).toContain('HRV');
    expect(copy).toContain('SpO₂');
    expect(copy).toContain(tr('today.focus'));
    const hero = screen.root.findAllByType(View).find((node) => node.props.testID === 'today-recovery-hero');
    expect(StyleSheet.flatten(hero.props.style).flexDirection).toBe(fontScale > 1.15 ? 'column' : 'row');
  } finally { dimensions.mockRestore(); }
});
