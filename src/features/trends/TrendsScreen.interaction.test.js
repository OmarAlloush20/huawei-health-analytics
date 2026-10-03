import React, { act } from 'react';
import TestRenderer from 'react-test-renderer';
import { afterEach, expect, jest, test } from '@jest/globals';
import { Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';
import { appDependencies } from '../../appDependencies';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../../providers/mock/mockHealthData';
import { buildTrendReport } from '../../services/trendEngine';
import { TrendChart } from './TrendChart';
import { TrendsScreen } from './TrendsScreen';
import { MetricPicker } from './MetricPicker';
import { RangeSelector } from './RangeSelector';
import { publishLanguage, tr } from '../../localization/i18n';

let mockTabPressListener = null;
const mockUnsubscribeTabPress = jest.fn(() => { mockTabPressListener = null; });
const mockNavigation = { addListener: jest.fn((event, listener) => { if (event === 'tabPress') mockTabPressListener = listener; return mockUnsubscribeTabPress; }) };
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useNavigation: () => mockNavigation,
  useFocusEffect: (effect) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('../../appDependencies', () => ({ appDependencies: { getPersistence: jest.fn() } }));
let mockDarkTheme = false;
jest.mock('../../theme/ThemeContext', () => ({ useAppTheme: () => ({ theme: jest.requireActual('../../theme/theme').createTheme(mockDarkTheme) }) }));
jest.mock('../../components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('../../components/ProductUI', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  return {
    Reveal: ({ children }) => React.createElement(View, null, children),
    SectionLabel: ({ title }) => React.createElement(Text, null, title),
    CompactState: ({ title }) => React.createElement(Text, null, title),
    ProductSheet: () => null,
  };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let screen;
afterEach(async () => { if (screen) await act(async () => screen.unmount()); screen = null; await act(async () => publishLanguage('en')); mockDarkTheme = false; jest.restoreAllMocks(); jest.clearAllMocks(); });

test('Arabic Trends retains ranges and comparison interaction with localized copy', async () => {
  publishLanguage('ar');
  const summaries = createMockHealthData('balanced', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE }).dailySummaries.value;
  const stats = { lastDate: MOCK_ANCHOR_DATE, sync: { range: { timeZone: MOCK_TIME_ZONE } } };
  const getReport = jest.fn(async (range) => buildTrendReport(range, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, summaries));
  appDependencies.getPersistence.mockResolvedValue({ dashboardService: { getStats: async () => stats, bootstrapDevelopmentDataIfEmpty: async (value) => value }, trendsService: { getReport } });
  await act(async () => { screen = TestRenderer.create(React.createElement(TrendsScreen)); });
  await act(async () => screen.root.findAll((node) => node.props.accessibilityLabel === tr('format.dayPeriod', { count: 30 }) && typeof node.props.onPress === 'function')[0].props.onPress());
  expect(getReport).toHaveBeenLastCalledWith('30d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
  const compare = screen.root.findAll((node) => typeof node.props.onPress === 'function' && node.findAll((child) => child.props.children === tr('trends.compare')).length)[0];
  await act(async () => compare.props.onPress());
  expect(screen.root.findByType(TrendChart).props.comparison).toBeDefined();
  const copy = screen.root.findAllByType(Text).map((node) => Array.isArray(node.props.children) ? node.props.children.filter((child) => typeof child === 'string').join('') : node.props.children).join(' ');
  expect(copy.replace(/HRV|RHR|SpO₂|RMSSD|ms|bpm|kcal|pts|min/g, '')).not.toMatch(/[A-Za-z]/);
});

test('refresh keeps the selected date but replaces its header, chart reading and detail context with fresh report values', async () => {
  const mockData = createMockHealthData('balanced', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  if (mockData.dailySummaries.status !== 'available') throw new Error('Expected mock history');
  const base = buildTrendReport('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, mockData.dailySummaries.value);
  const selectedDate = base.series.recovery.points.find((point) => point.status === 'available').date;
  const withReading = (value) => ({ ...base, series: { ...base.series, recovery: { ...base.series.recovery, points: base.series.recovery.points.map((point) => point.date === selectedDate ? { ...point, value } : point) } } });
  const getReport = jest.fn().mockResolvedValueOnce(withReading(55.5)).mockResolvedValueOnce(withReading(88.5));
  const stats = { lastDate: MOCK_ANCHOR_DATE, sync: { range: { timeZone: MOCK_TIME_ZONE } } };
  appDependencies.getPersistence.mockResolvedValue({
    dashboardService: { getStats: jest.fn().mockResolvedValue(stats), bootstrapDevelopmentDataIfEmpty: jest.fn().mockResolvedValue(stats) },
    trendsService: { getReport },
  });
  await act(async () => { screen = TestRenderer.create(React.createElement(TrendsScreen)); });
  const chart = () => screen.root.findByType(TrendChart);
  const adjustable = () => screen.root.findByProps({ accessibilityRole: 'adjustable' });
  await act(async () => adjustable().props.onResponderGrant({ nativeEvent: { locationX: 0 } }));
  await act(async () => adjustable().props.onResponderRelease());
  expect(chart().props.selectedDate).toBe(selectedDate);
  expect(screen.root.findAllByType(Text).some((node) => node.props.children === '55.5')).toBe(true);

  const refresh = screen.root.findAll((node) => typeof node.props.onRefresh === 'function')[0];
  await act(async () => refresh.props.onRefresh());
  expect(getReport).toHaveBeenCalledTimes(2);
  expect(chart().props.selectedDate).toBe(selectedDate);
  expect(screen.root.findAllByType(Text).some((node) => node.props.children === '88.5')).toBe(true);
  expect(screen.root.findAllByType(Text).some((node) => node.props.children === '55.5')).toBe(false);
  expect(adjustable().props.accessibilityValue.text).toContain('88.5 pts');
  // Model the real touch-start bubble before a Details press. The contextual
  // header belongs to the chart workspace, so its inspected date is preserved.
  const event = { nativeEvent: { identifier: 0, timestamp: 1, target: 4 } };
  const workspace = screen.root.findAll((node) => node.props.testID === 'trends-chart-workspace' && typeof node.props.onTouchStart === 'function')[0];
  const boundary = screen.root.findAll((node) => node.props.testID === 'trends-inspection-boundary' && typeof node.props.onTouchStart === 'function')[0];
  await act(async () => { workspace.props.onTouchStart(event); boundary.props.onTouchStart(event); });
  expect(chart().props.selectedDate).toBe(selectedDate);
  const details = screen.root.findAll((node) => node.props.accessibilityLabel === 'Open Recovery details' && typeof node.props.onPress === 'function')[0];
  await act(async () => details.props.onPress());
  expect(router.push).toHaveBeenCalledWith({ pathname: '/metric/[metric]', params: { metric: 'recovery', date: selectedDate } });
});

test('metric/range/Compare and outside touches clear inspection while a remembered workspace restores without a tooltip', async () => {
  const data = createMockHealthData('balanced', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  const summaries = data.dailySummaries.value;
  let saved = { metric: 'hrv-rmssd', range: '30d' };
  const preferences = { getTrendsWorkspace: jest.fn(async () => saved), setTrendsWorkspace: jest.fn(async (next) => { saved = next; }) };
  const stats = { lastDate: MOCK_ANCHOR_DATE, sync: { range: { timeZone: MOCK_TIME_ZONE } } };
  const getReport = jest.fn(async (range) => buildTrendReport(range, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, summaries));
  appDependencies.getPersistence.mockResolvedValue({ productPreferences: preferences, dashboardService: { getStats: async () => stats, bootstrapDevelopmentDataIfEmpty: async () => stats }, trendsService: { getReport } });
  await act(async () => { screen = TestRenderer.create(React.createElement(TrendsScreen)); });
  const chart = () => screen.root.findByType(TrendChart);
  const choosePoint = async () => {
    const observation = chart().props.points.find((point) => point.status === 'available' && Number.isFinite(point.value));
    await act(async () => chart().props.onSelectionChange(observation));
    expect(chart().props.selectedDate).toBe(observation.date);
  };
  expect(screen.root.findByType(RangeSelector).props.value).toBe('30d');
  expect(screen.root.findAllByType(MetricPicker)[0].props.value).toBe('hrv-rmssd');
  expect(getReport).toHaveBeenCalledTimes(1);
  expect(getReport).toHaveBeenLastCalledWith('30d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
  expect(chart().props.selectedDate).toBeNull();
  expect(preferences.setTrendsWorkspace).not.toHaveBeenCalled();

  await choosePoint();
  const boundary = screen.root.findAll((node) => node.props.testID === 'trends-inspection-boundary' && typeof node.props.onTouchStart === 'function')[0];
  await act(async () => boundary.props.onTouchStart({ nativeEvent: { identifier: 0, target: 5, timestamp: 1 } }));
  expect(chart().props.selectedDate).toBeNull();
  expect(screen.root.findByProps({ accessibilityRole: 'adjustable' }).props.accessibilityValue.text).not.toContain(' ms');

  await choosePoint();
  await act(async () => screen.root.findAllByType(MetricPicker)[0].props.onChange('steps'));
  expect(chart().props.selectedDate).toBeNull();
  expect(preferences.setTrendsWorkspace).toHaveBeenLastCalledWith({ metric: 'steps', range: '30d' });
  await choosePoint();
  await act(async () => screen.root.findByType(RangeSelector).props.onChange('90d'));
  expect(chart().props.selectedDate).toBeNull();
  expect(preferences.setTrendsWorkspace).toHaveBeenLastCalledWith({ metric: 'steps', range: '90d' });

  const compare = () => screen.root.findAll((node) => typeof node.props.onPress === 'function' && node.findAll((child) => child.props.children === tr(chart().props.comparison ? 'trends.endCompare' : 'trends.compare')).length)[0];
  await choosePoint();
  await act(async () => compare().props.onPress());
  expect(chart().props.selectedDate).toBeNull();
  expect(chart().props.comparison).toBeDefined();
  await choosePoint();
  await act(async () => screen.root.findAllByType(MetricPicker).find((picker) => picker.props.comparison).props.onChange('sleep-duration'));
  expect(chart().props.selectedDate).toBeNull();
  await choosePoint();
  await act(async () => compare().props.onPress());
  expect(chart().props.selectedDate).toBeNull();
  expect(chart().props.comparison).toBeUndefined();
  expect(preferences.setTrendsWorkspace).toHaveBeenCalledTimes(2);

  await choosePoint();
  await act(async () => screen.unmount());
  await act(async () => { screen = TestRenderer.create(React.createElement(TrendsScreen)); });
  expect(screen.root.findByType(RangeSelector).props.value).toBe('90d');
  expect(screen.root.findAllByType(MetricPicker)[0].props.value).toBe('steps');
  expect(chart().props.selectedDate).toBeNull();
  expect(chart().props.comparison).toBeUndefined();
});

test.each([true, false].flatMap((dark) => ['en', 'ar'].flatMap((language) => [[360, 1], [390, 1], [412, 1], [600, 1], [360, 2], [390, 2], [412, 2], [600, 2]].map(([width, fontScale]) => [dark, language, width, fontScale]))))('premium Trends workspace (dark=%s, %s, %idp, %sx) has adaptive composition and truthful compact stats', async (dark, language, width, fontScale) => {
  mockDarkTheme = dark;
  jest.spyOn(jest.requireActual('react-native'), 'useWindowDimensions').mockReturnValue({ width, height: 780, fontScale, scale: 1 });
  await act(async () => publishLanguage(language));
  const data = createMockHealthData('balanced', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  const report = buildTrendReport('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, data.dailySummaries.value);
  const stats = { lastDate: MOCK_ANCHOR_DATE, sync: { range: { timeZone: MOCK_TIME_ZONE } } };
  appDependencies.getPersistence.mockResolvedValue({ productPreferences: { getTrendsWorkspace: async () => ({ metric: 'hrv-rmssd', range: '7d' }) }, dashboardService: { getStats: async () => stats, bootstrapDevelopmentDataIfEmpty: async () => stats }, trendsService: { getReport: async () => report } });
  await act(async () => { screen = TestRenderer.create(React.createElement(TrendsScreen)); });
  const nativeStyle = (id) => StyleSheet.flatten(screen.root.findAllByType(View).find((node) => node.props.testID === id).props.style);
  expect(nativeStyle('trends-metric-toolbar').flexDirection).toBe(fontScale > 1.2 ? 'column' : 'row');
  expect(nativeStyle('trends-reading-header').flexDirection).toBe(fontScale > 1.35 ? 'column' : 'row');
  expect(nativeStyle('trends-period-facts').flexDirection).toBe(fontScale > 1.35 ? 'column' : 'row');
  expect(screen.root.findByType(TrendChart).props.height).toBeGreaterThanOrEqual(336);
  expect(screen.root.findByType(TrendChart).props.selectedDate).toBeNull();
  expect(screen.root.findByType(TrendChart).props.accessibilityLabel).toContain(tr('metric.hrvFull'));
  expect(screen.root.findByType(SafeAreaView).props.edges).toEqual(['top', 'left', 'right']);
  const coverage = screen.root.findAll((node) => node.props.accessibilityRole === 'progressbar')[0];
  expect(coverage.props.accessibilityValue.now).toBe(report.series['hrv-rmssd'].availableDays);
  expect(coverage.props.accessibilityValue.max).toBe(report.series['hrv-rmssd'].expectedDays);
  const measurement = screen.root.findAllByType(MetricPicker)[0];
  expect(measurement.props.options.find((option) => option.id === 'hrv-rmssd').shortLabel).toBe('HRV');
  expect(measurement.props.options.find((option) => option.id === 'hrv-rmssd').label).toContain(tr('metric.hrvFull'));
  const copy = screen.root.findAllByType(Text).map((node) => Array.isArray(node.props.children) ? node.props.children.filter((child) => typeof child === 'string').join('') : node.props.children).join(' ');
  expect(copy).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
  if (language === 'ar') expect(copy.replace(/HRV|RHR|SpO₂|RMSSD|ms|bpm|kcal|pts|min/g, '')).not.toMatch(/[A-Za-z]/);
  screen.root.findAllByType(Text).forEach((node) => { expect(node.props.ellipsizeMode).toBeUndefined(); expect(node.props.numberOfLines).toBeUndefined(); });
});

test('Arabic Steps workspace and inspected value localize ordinary units while retaining Western digits', async () => {
  await act(async () => publishLanguage('ar'));
  const data = createMockHealthData('balanced', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  const report = buildTrendReport('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, data.dailySummaries.value);
  const stats = { lastDate: MOCK_ANCHOR_DATE, sync: { range: { timeZone: MOCK_TIME_ZONE } } };
  appDependencies.getPersistence.mockResolvedValue({ productPreferences: { getTrendsWorkspace: async () => ({ metric: 'steps', range: '7d' }) }, dashboardService: { getStats: async () => stats, bootstrapDevelopmentDataIfEmpty: async () => stats }, trendsService: { getReport: async () => report } });
  await act(async () => { screen = TestRenderer.create(React.createElement(TrendsScreen)); });
  const chart = screen.root.findByType(TrendChart);
  expect(chart.props.unit).toBe('خطوة');
  await act(async () => chart.props.onSelectionChange(chart.props.points.find((point) => point.status === 'available')));
  const copy = screen.root.findAllByType(Text).map((node) => Array.isArray(node.props.children) ? node.props.children.filter((child) => typeof child === 'string').join('') : node.props.children).join(' ');
  expect(copy).not.toMatch(/steps|[\u0660-\u0669\u06F0-\u06F9]/);
  expect(copy).toContain('خطوة');
});

test('pressing the already selected Trends tab exits inspection without changing workspace or preventing navigation, and unsubscribes on unmount', async () => {
  const data = createMockHealthData('balanced', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  const report = buildTrendReport('30d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, data.dailySummaries.value);
  const stats = { lastDate: MOCK_ANCHOR_DATE, sync: { range: { timeZone: MOCK_TIME_ZONE } } };
  const preferences = { getTrendsWorkspace: async () => ({ metric: 'hrv-rmssd', range: '30d' }), setTrendsWorkspace: jest.fn() };
  const getReport = jest.fn(async () => report);
  appDependencies.getPersistence.mockResolvedValue({ productPreferences: preferences, dashboardService: { getStats: async () => stats, bootstrapDevelopmentDataIfEmpty: async () => stats }, trendsService: { getReport } });
  await act(async () => { screen = TestRenderer.create(React.createElement(TrendsScreen)); });
  expect(mockNavigation.addListener).toHaveBeenCalledWith('tabPress', expect.any(Function));
  expect(mockNavigation.addListener).toHaveBeenCalledTimes(1);
  const chart = () => screen.root.findByType(TrendChart);
  const observation = chart().props.points.find((point) => point.status === 'available');
  await act(async () => { chart().props.onScrubChange(true); chart().props.onSelectionChange(observation); });
  expect(chart().props.selectedDate).toBe(observation.date);
  const event = { target: 'trends-route-key', preventDefault: jest.fn() };
  await act(async () => mockTabPressListener(event));
  expect(chart().props.selectedDate).toBeNull();
  expect(screen.root.findAll((node) => node.props.scrollEnabled !== undefined)[0].props.scrollEnabled).toBe(true);
  expect(screen.root.findByType(RangeSelector).props.value).toBe('30d');
  expect(screen.root.findAllByType(MetricPicker)[0].props.value).toBe('hrv-rmssd');
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(preferences.setTrendsWorkspace).not.toHaveBeenCalled();
  expect(getReport).toHaveBeenCalledTimes(1);
  await act(async () => screen.unmount());
  screen = null;
  expect(mockUnsubscribeTabPress).toHaveBeenCalledTimes(1);
  expect(mockTabPressListener).toBeNull();
});
