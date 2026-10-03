import React, { act } from 'react';
import { create } from 'react-test-renderer';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { StyleSheet } from 'react-native';

import { publishLanguage, tr } from '../../localization/i18n';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE } from '../../providers/mock/mockHealthData';
import { calculateDailyBaselines } from '../../services/baselineEngine';
import { calculateRecovery } from '../../services/recoveryEngine';
import { buildTrendReport } from '../../services/trendEngine';
import { createTheme } from '../../theme/theme';
import { MetricDayContext } from './MetricDayContext';

jest.mock('../../components/SignalVisuals', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { MovementBars: (props) => React.createElement(View, { ...props, testID: 'movement-observations' }), SleepComposition: (props) => React.createElement(View, { ...props, testID: 'sleep-observations' }) };
});

let screen;
let previousActFlag;
let warnings;
beforeEach(() => {
  previousActFlag = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const originalError = console.error;
  warnings = jest.spyOn(console, 'error').mockImplementation((...args) => { if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args); });
});
afterEach(async () => {
  await act(async () => screen?.unmount());
  screen = undefined;
  publishLanguage('en');
  warnings.mockRestore();
  global.IS_REACT_ACT_ENVIRONMENT = previousActFlag;
});
function fixture() {
  const summaries = createMockHealthData('balanced', { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE }).dailySummaries.value;
  const summary = summaries.at(-1);
  const baselines = calculateDailyBaselines(summaries.slice(0, -1), summary, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
  const report = buildTrendReport('30d', MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, summaries);
  return { day: { summary, baselines, recovery: calculateRecovery(baselines), insight: null }, history: { report, points: report.series.steps.points } };
}
function copy(node) { return typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(copy).join(' ') : node?.children?.map(copy).join(' ') ?? ''; }
async function render(metric, data, language = 'en') {
  publishLanguage(language);
  await act(async () => { screen = create(<MetricDayContext {...data} metric={metric} theme={createTheme(true)} singleColumn />); });
}

test('Recovery contributor expansion exposes the original baseline and weights without altering the score', async () => {
  const data = fixture();
  const original = JSON.stringify(data.day.recovery);
  await render('recovery', data);
  expect(copy(screen.toJSON())).not.toContain('Baseline');
  const button = screen.root.findAll((node) => node.props.accessibilityState?.expanded === false && typeof node.props.onPress === 'function')[0];
  expect(button.props.accessibilityLabel).toContain('40% configured');
  await act(async () => { button.props.onPress(); });
  expect(copy(screen.toJSON())).toContain('Baseline');
  expect(copy(screen.toJSON())).toContain('40% configured');
  expect(JSON.stringify(data.day.recovery)).toBe(original);
  await act(async () => { button.props.onPress(); });
  expect(copy(screen.toJSON())).not.toContain('Baseline');
});

test.each(['spo2', 'stress'])('%s recorded-span rail uses only the day’s exact observations and no thresholds', async (metric) => {
  const data = fixture();
  const source = metric === 'spo2' ? data.day.summary.oxygenSaturation.value : data.day.summary.stress.value;
  const minimum = metric === 'spo2' ? source.minimumPercent : source.minimumIndex;
  const maximum = metric === 'spo2' ? source.maximumPercent : source.maximumIndex;
  await render(metric, data, 'ar');
  const text = copy(screen.toJSON());
  expect(text).toContain(String(minimum));
  expect(text).toContain(String(maximum));
  expect(text).not.toMatch(/[\u0660-\u0669\u06f0-\u06f9]/);
  expect(screen.root.findAllByProps({ testID: `observed-span-${metric}` }).length).toBeGreaterThan(0);
  expect(text).not.toMatch(/normal|healthy|danger|target|goal|تحذير|خطر|هدف/i);
});

test('identical recorded Stress observations produce a centered, finite average marker', async () => {
  const data = fixture();
  data.day.summary = { ...data.day.summary, stress: { status: 'available', value: { ...data.day.summary.stress.value, minimumIndex: 35, maximumIndex: 35, averageIndex: 35 } } };
  await render('stress', data);
  const marker = screen.root.findAllByProps({ testID: 'observed-average-marker' })[0];
  expect(StyleSheet.flatten(marker.props.style).start).toBe('50%');
  expect(copy(screen.toJSON())).toContain('35 / 100');
});

test('Sleep composition receives the original reported stages rather than a reconstructed timeline', async () => {
  const data = fixture();
  await render('sleep', data);
  expect(screen.root.findAllByProps({ testID: 'sleep-observations' })[0].props.sleep).toBe(data.day.summary.sleep.value);
});

test('Movement keeps seven chronological slots, never looks beyond the selected day, and invents no goals', async () => {
  const data = fixture();
  const selectedDate = data.history.points.at(-4).date;
  data.day.summary = { ...data.day.summary, date: selectedDate };
  await render('activity', data);
  const plot = screen.root.findAllByProps({ testID: 'movement-observations' })[0];
  expect(plot.props.points).toHaveLength(7);
  expect(plot.props.points.at(-1).date).toBe(selectedDate);
  expect(plot.props.selectedDate).toBe(selectedDate);
  expect(plot.props.points.every((point) => point.date <= selectedDate)).toBe(true);
  expect(copy(screen.toJSON())).not.toMatch(/goal|target/i);
});

test('failed metric reads show a quiet product state without raw provider errors', async () => {
  const data = fixture();
  data.day.summary = { ...data.day.summary, oxygenSaturation: { status: 'query-failed', reason: 'JNI exception: stack trace / permission debug details' } };
  await render('spo2', data);
  expect(copy(screen.toJSON())).toContain(tr('common.readingUnavailable'));
  expect(copy(screen.toJSON())).not.toMatch(/JNI|stack trace|permission debug/);
});
