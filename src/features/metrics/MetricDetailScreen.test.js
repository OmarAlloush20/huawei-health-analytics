import React, { act } from 'react';
import { create } from 'react-test-renderer';
import { expect, jest, test } from '@jest/globals';
import * as ReactNative from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appDependencies } from '../../appDependencies';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../../providers/mock/mockHealthData';
import { calculateDailyBaselines } from '../../services/baselineEngine';
import { calculateRecovery } from '../../services/recoveryEngine';
import { buildTrendReport } from '../../services/trendEngine';
import { addLocalDays } from '../../shared/dates/healthDates';
import { MetricDetailScreen } from './MetricDetailScreen';
import { publishLanguage, tr } from '../../localization/i18n';

let mockFocusVersion = 0;
let mockRouteMetric = 'recovery';
let mockDarkTheme = true;
jest.mock('../../appDependencies', () => ({ appDependencies: { getPersistence: jest.fn() } }));
jest.mock('expo-router', () => ({ router: { back: jest.fn() }, useLocalSearchParams: () => ({ metric: mockRouteMetric, date: '2026-09-30' }), useFocusEffect: (effect) => jest.requireActual('react').useEffect(effect, [effect, mockFocusVersion]) }));
jest.mock('../../theme/ThemeContext', () => ({ useAppTheme: () => ({ theme: jest.requireActual('../../theme/theme').createTheme(mockDarkTheme) }) }));
jest.mock('../../components/SignalVisuals', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  return { RecoveryGauge: ({ score }) => React.createElement(Text, null, score ?? 'No score'), MovementBars: (props) => React.createElement(View, { ...props, testID: 'detail-movement-plot' }), SleepComposition: (props) => React.createElement(View, { ...props, testID: 'detail-sleep-composition' }) };
});
jest.mock('../trends/TrendChart', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { TrendChart: (props) => React.createElement(View, { ...props, testID: 'detail-chart' }) };
});
jest.mock('../trends/RangeSelector', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { RangeSelector: (props) => React.createElement(View, { ...props, testID: 'detail-range' }) };
});

function textContent(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join(' ');
  return node?.children?.map(textContent).join(' ') ?? '';
}

test.each([true, false].flatMap((dark) => ['en', 'ar'].flatMap((language) => [[360, 1], [390, 1], [412, 1], [768, 1], [360, 2]].map(([width, fontScale]) => [dark, language, width, fontScale]))))('Recovery composition (dark=%s) in %s at %idp / %sx uses readable full-width copy', async (dark, language, width, fontScale) => {
  await assertLocalizedDetail('recovery', language, width, fontScale, dark);
});
test.each([true, false].flatMap((dark) => ['en', 'ar'].flatMap((language) => ['sleep', 'hrv', 'rhr', 'spo2', 'stress', 'activity'].flatMap((metric) => [[360, 1], [390, 1], [412, 1], [768, 1], [360, 2]].map(([width, fontScale]) => [dark, language, metric, width, fontScale])))))('Detail (dark=%s) %s / %s at %idp / %sx has complete readable copy', async (dark, language, metric, width, fontScale) => {
  await assertLocalizedDetail(metric, language, width, fontScale, dark);
});

async function assertLocalizedDetail(metric, language, width, fontScale, dark) {
  const previousActFlag = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockRouteMetric = metric;
  mockDarkTheme = dark;
  publishLanguage(language);
  const dimensions = jest.spyOn(jest.requireActual('react-native'), 'useWindowDimensions').mockReturnValue({ width, height: 780, fontScale, scale: 1 });
  const originalError = console.error;
  const warnings = jest.spyOn(console, 'error').mockImplementation((...args) => { if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args); });
  const summaries = createMockHealthData('balanced', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE }).dailySummaries.value;
  const summary = summaries.at(-1);
  const baselines = calculateDailyBaselines(summaries.slice(0, -1), summary, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
  const day = { summary, baselines, recovery: calculateRecovery(baselines), insight: null };
  const stats = { firstDate: summaries[0].date, lastDate: MOCK_ANCHOR_DATE, provider: 'mock', storedDays: summaries.length, sync: { range: { timeZone: MOCK_TIME_ZONE } } };
  appDependencies.getPersistence.mockResolvedValue({ dashboardService: { getStats: async () => stats, bootstrapDevelopmentDataIfEmpty: async (value) => value, readDay: async () => day }, repository: { getDailySummaries: async () => summaries }, trendsService: { getReport: async (range, date, timeZone) => buildTrendReport(range, date, timeZone, summaries) } });
  let screen;
  try {
    await act(async () => { screen = create(React.createElement(MetricDetailScreen)); });
    const copy = textContent(screen.toJSON());
    expect(screen.root.findByType(SafeAreaView).props.edges).toEqual(['top', 'right', 'bottom', 'left']);
    expect(screen.root.findAllByProps({ testID: 'detail-chart' })[0].props.selectedDate).toBeNull();
    expect(screen.root.findAllByProps({ testID: 'detail-chart' })[0].props.height).toBeGreaterThanOrEqual(276);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('detail-day-context')).toBeLessThan(tree.indexOf('detail-history'));
    expect(screen.root.findAllByProps({ testID: `day-context-${metric}` }).length).toBeGreaterThan(0);
    if (metric === 'recovery') {
      expect(copy).toContain(tr(`recovery.${day.recovery.category}`));
      const hero = screen.root.findAllByProps({ testID: 'detail-recovery-hero' })[0];
      expect(ReactNative.StyleSheet.flatten(hero.props.style).flexDirection).toBe(width < 440 || fontScale > 1.15 ? 'column' : 'row');
    }
    if (language === 'ar') {
      expect(copy.replace(/HRV|RHR|SpO₂|RMSSD|ms|bpm|kcal|km|V1|No score/g, '')).not.toMatch(/[A-Za-z]/);
      expect(copy).not.toMatch(/[\u0660-\u0669\u06f0-\u06f9]/);
    }
    for (const node of screen.root.findAllByType(ReactNative.Text)) expect(node.props.numberOfLines).toBeUndefined();
  } finally {
    await act(async () => screen?.unmount());
    publishLanguage('en');
    mockRouteMetric = 'recovery';
    mockDarkTheme = true;
    dimensions.mockRestore();
    warnings.mockRestore();
    global.IS_REACT_ACT_ENVIRONMENT = previousActFlag;
  }
}

test('scrubbing updates day context, periods retain the anchor, and deletion clears cached history on refocus', async () => {
  const previousActFlag = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const originalError = console.error;
  const warnings = jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args);
  });
  const source = createMockHealthData('low-hrv-elevated-rhr', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  const summaries = source.dailySummaries.value;
  const makeDay = (date) => {
    const summary = summaries.find((item) => item.date === date);
    const baselines = calculateDailyBaselines(summaries.filter((item) => item.date < date), summary, date, MOCK_TIME_ZONE);
    return { summary, baselines, recovery: calculateRecovery(baselines), insight: null };
  };
  const initial = makeDay(MOCK_ANCHOR_DATE);
  const historicalDate = addLocalDays(MOCK_ANCHOR_DATE, -14);
  const historical = makeDay(historicalDate);
  let resolveHistorical;
  const pending = new Promise((resolve) => { resolveHistorical = resolve; });
  const readDay = jest.fn((date) => date === historicalDate ? pending : Promise.resolve(makeDay(date)));
  const getReport = jest.fn(async (range, date, timeZone) => buildTrendReport(range, date, timeZone, summaries));
  const stats = { firstDate: summaries[0].date, lastDate: MOCK_ANCHOR_DATE, provider: 'mock', storedDays: summaries.length, sync: { range: { timeZone: MOCK_TIME_ZONE } } };
  appDependencies.getPersistence.mockResolvedValue({ dashboardService: { getStats: async () => stats, bootstrapDevelopmentDataIfEmpty: async (value) => value, readDay }, repository: { getDailySummaries: async () => summaries }, trendsService: { getReport } });
  let screen;
  try {
    await act(async () => { screen = create(React.createElement(MetricDetailScreen)); });
    expect(textContent(screen.toJSON())).toContain(initial.recovery.explanation);
    expect(screen.root.findAll((node) => node.props.accessibilityLabel?.startsWith('Heart rate variability,')).length).toBeGreaterThan(0);
    expect(screen.root.findAll((node) => node.props.accessibilityLabel?.startsWith('Sleep duration,')).length).toBeGreaterThan(0);
    const chart = screen.root.findAllByProps({ testID: 'detail-chart' })[0];
    expect(chart.props.selectedDate).toBeNull();
    const selected = chart.props.points.find((point) => point.date === historicalDate);
    await act(async () => { chart.props.onSelectionChange(selected); });
    expect(readDay).toHaveBeenLastCalledWith(historicalDate, MOCK_TIME_ZONE);
    expect(textContent(screen.toJSON())).not.toContain(initial.recovery.explanation);
    expect(textContent(screen.toJSON())).toContain('Loading this day’s context');
    await act(async () => { resolveHistorical(historical); });
    expect(textContent(screen.toJSON())).toContain(historical.recovery.explanation);
    expect(screen.root.findAllByProps({ testID: 'detail-chart' })[0].props.selectedDate).toBe(historicalDate);
    const chartTouch = { nativeEvent: {} };
    await act(async () => {
      screen.root.findAllByProps({ testID: 'detail-chart-workspace' }).find((node) => typeof node.props.onTouchStart === 'function').props.onTouchStart(chartTouch);
      screen.root.findAllByProps({ testID: 'detail-inspection-boundary' }).find((node) => typeof node.props.onTouchStart === 'function').props.onTouchStart(chartTouch);
    });
    expect(screen.root.findAllByProps({ testID: 'detail-chart' })[0].props.selectedDate).toBe(historicalDate);
    const contributorButton = screen.root.findAll((node) => node.props.accessibilityLabel?.startsWith('Heart rate variability,') && typeof node.props.onPress === 'function')[0];
    const readsBeforeOutsidePress = readDay.mock.calls.length;
    // An outside touch returns the narrative to its anchor without leaving a tooltip.
    await act(async () => { screen.root.findAllByProps({ testID: 'detail-inspection-boundary' }).find((node) => typeof node.props.onTouchStart === 'function').props.onTouchStart({ nativeEvent: {} }); });
    expect(screen.root.findAllByProps({ testID: 'detail-chart' })[0].props.selectedDate).toBeNull();
    expect(textContent(screen.toJSON())).toContain(initial.recovery.explanation);
    // A live touch-start → reset → press keeps the contributor mounted and pressable.
    expect(screen.root.findAll((node) => node.props.accessibilityLabel?.startsWith('Heart rate variability,') && typeof node.props.onPress === 'function')).toContain(contributorButton);
    await act(async () => { contributorButton.props.onPress(); });
    expect(textContent(screen.toJSON())).toContain('Baseline');
    expect(readDay.mock.calls.length).toBe(readsBeforeOutsidePress);
    await act(async () => { chart.props.onSelectionChange(selected); });
    await act(async () => { screen.root.findAllByProps({ testID: 'detail-range' })[0].props.onChange('7d'); });
    expect(getReport).toHaveBeenLastCalledWith('7d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
    expect(screen.root.findAllByProps({ testID: 'detail-chart' })[0].props.selectedDate).toBeNull();
    const recent = screen.root.findAllByProps({ testID: 'detail-chart' })[0].props.points.find((point) => point.status === 'available');
    await act(async () => { screen.root.findAllByProps({ testID: 'detail-chart' })[0].props.onSelectionChange(recent); });
    expect(screen.root.findAllByProps({ testID: 'detail-chart' })[0].props.selectedDate).toBe(recent.date);
    const previousHistoryReads = getReport.mock.calls.length;
    const previousDayReads = readDay.mock.calls.length;
    await act(async () => { mockFocusVersion += 1; screen.update(React.createElement(MetricDetailScreen)); });
    expect(getReport.mock.calls.length).toBe(previousHistoryReads + 1);
    expect(readDay.mock.calls.length).toBe(previousDayReads + 1);
    expect(screen.root.findAllByProps({ testID: 'detail-chart' })[0].props.selectedDate).toBeNull();
    await act(async () => { screen.root.findAllByProps({ testID: 'detail-chart' })[0].props.onSelectionChange(recent); });
    await act(async () => { mockRouteMetric = 'hrv'; screen.update(React.createElement(MetricDetailScreen)); });
    expect(screen.root.findAllByProps({ testID: 'detail-chart' })[0].props.selectedDate).toBeNull();
    expect(screen.root.findAllByProps({ testID: 'detail-chart' })[0].props.unit).toBe('ms');
    await act(async () => { mockRouteMetric = 'recovery'; screen.update(React.createElement(MetricDetailScreen)); });
    stats.storedDays = 0;
    stats.firstDate = undefined;
    stats.lastDate = undefined;
    await act(async () => { mockFocusVersion += 1; screen.update(React.createElement(MetricDetailScreen)); });
    expect(screen.root.findAllByProps({ testID: 'detail-chart' })).toHaveLength(0);
    expect(textContent(screen.toJSON())).not.toContain(initial.recovery.explanation);
    expect(textContent(screen.toJSON())).not.toContain('What shaped this score');
    expect(textContent(screen.toJSON())).toContain('Sync your health data to explore your history.');
  } finally {
    if (screen) await act(async () => { screen.unmount(); });
    warnings.mockRestore();
    mockRouteMetric = 'recovery';
    global.IS_REACT_ACT_ENVIRONMENT = previousActFlag;
  }
});

test.each(['sleep', 'activity'])('%s hero reflows at 360dp and double text size without truncation', async (metric) => {
  const previousActFlag = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockRouteMetric = metric;
  const dimensions = jest.spyOn(jest.requireActual('react-native'), 'useWindowDimensions').mockReturnValue({ width: 360, height: 780, fontScale: 2, scale: 1 });
  const originalError = console.error;
  const warnings = jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args);
  });
  const source = createMockHealthData('balanced', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  const summaries = source.dailySummaries.value;
  const summary = summaries.at(-1);
  const baselines = calculateDailyBaselines(summaries.slice(0, -1), summary, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
  const day = { summary, baselines, recovery: calculateRecovery(baselines), insight: null };
  const stats = { firstDate: summaries[0].date, lastDate: MOCK_ANCHOR_DATE, provider: 'mock', storedDays: summaries.length, sync: { range: { timeZone: MOCK_TIME_ZONE } } };
  appDependencies.getPersistence.mockResolvedValue({ dashboardService: { getStats: async () => stats, bootstrapDevelopmentDataIfEmpty: async (value) => value, readDay: async () => day }, repository: { getDailySummaries: async () => summaries }, trendsService: { getReport: async (range, date, timeZone) => buildTrendReport(range, date, timeZone, summaries) } });
  let screen;
  try {
    await act(async () => { screen = create(React.createElement(MetricDetailScreen)); });
    const values = screen.root.findAll((node) => ReactNative.StyleSheet.flatten(node.props.style)?.fontSize === 44);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(ReactNative.StyleSheet.flatten(value.props.style)).toMatchObject({ maxWidth: '100%', flexShrink: 1 });
      expect(value.props.numberOfLines).toBeUndefined();
    }
    expect(screen.root.findAll((node) => {
      const style = ReactNative.StyleSheet.flatten(node.props.style);
      return style?.rowGap === 4 && style.flexDirection === 'column' && style.alignItems === 'flex-start';
    }).length).toBeGreaterThan(0);
  } finally {
    if (screen) await act(async () => { screen.unmount(); });
    dimensions.mockRestore();
    warnings.mockRestore();
    mockRouteMetric = 'recovery';
    global.IS_REACT_ACT_ENVIRONMENT = previousActFlag;
  }
});
