import React, { act } from 'react';
import { afterEach, expect, jest, test } from '@jest/globals';
import TestRenderer from 'react-test-renderer';
import { StyleSheet, Text, View } from 'react-native';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_HEALTH_SCENARIOS, MOCK_TIME_ZONE } from '../../providers/mock/mockHealthData';
import { calculateDailyBaselines } from '../../services/baselineEngine';
import { calculateRecovery } from '../../services/recoveryEngine';
import { publishLanguage, tr } from '../../localization/i18n';
import { createTheme } from '../../theme/theme';
import { buildDashboardViewModel } from './dashboardViewModel';
import { contributionWeight } from './todayPresentation';
import { TodayRecovery } from './TodayRecovery';

jest.mock('../../components/SignalVisuals', () => {
  const React = jest.requireActual('react'), { Text } = jest.requireActual('react-native');
  return { RecoveryGauge: ({ score }) => React.createElement(Text, { testID: 'recovery-score' }, score ?? '—') };
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let screen;
afterEach(async () => { await act(async () => screen?.unmount()); screen = null; jest.restoreAllMocks(); publishLanguage('en'); });
function fixture(scenario) {
  const data = createMockHealthData(scenario, { start: '2026-09-02', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  if (data.dailySummaries.status !== 'available') throw new Error('Expected fixtures');
  const summary = data.dailySummaries.value.at(-1);
  const baselines = calculateDailyBaselines(data.dailySummaries.value, summary, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE);
  const recovery = calculateRecovery(baselines);
  return { recovery, presentation: buildDashboardViewModel(summary, MOCK_ANCHOR_DATE, baselines, recovery).recovery };
}
const copy = () => screen.root.findAllByType(Text).map((node) => node.props.children).join(' ');

test.each(MOCK_HEALTH_SCENARIOS.map(({ id }) => id))('%s daily canvas renders only the existing engine score and three truthful contributors', async (scenario) => {
  const props = fixture(scenario), unchanged = JSON.stringify(props.recovery), onOpen = jest.fn(), onExpand = jest.fn();
  await act(async () => { screen = TestRenderer.create(<TodayRecovery {...props} expanded={false} onExpand={onExpand} onOpen={onOpen} theme={createTheme(true)} />); });
  expect(screen.root.findByProps({ testID: 'recovery-score' }).props.children).toBe(props.recovery.score ?? '—');
  for (const metric of ['hrv', 'rhr', 'sleep']) {
    const button = screen.root.findAll((node) => node.props.testID === `today-contributor-${metric}` && node.props.onPress)[0];
    expect(button.props.accessibilityLabel).toContain(contributionWeight(props.recovery.contributions[['hrv', 'rhr', 'sleep'].indexOf(metric)]));
    await act(async () => button.props.onPress());
    expect(onOpen).toHaveBeenLastCalledWith(metric);
  }
  expect(copy()).not.toContain(tr('today.modelDetails'));
  await act(async () => screen.root.findAll((node) => node.props.accessibilityState?.expanded === false && node.props.onPress)[0].props.onPress());
  expect(onExpand).toHaveBeenCalledTimes(1);
  await act(async () => screen.update(<TodayRecovery {...props} expanded onExpand={onExpand} onOpen={onOpen} theme={createTheme(true)} />));
  expect(copy()).toContain(tr('today.modelDetails'));
  props.recovery.contributions.forEach((item) => expect(copy()).toContain(contributionWeight(item)));
  expect(JSON.stringify(props.recovery)).toBe(unchanged);
  expect(props.recovery.contributions.map((item) => item.configuredWeight)).toEqual([0.4, 0.35, 0.25]);
  expect(screen.root.findAllByType(Text).every((node) => node.props.numberOfLines === undefined)).toBe(true);
});

test.each([true, false])('Arabic daily Recovery reflows at360dp/2x in dark=%s without untranslated ordinary copy or non-Western health digits', async (dark) => {
  publishLanguage('ar');
  jest.spyOn(jest.requireActual('react-native'), 'useWindowDimensions').mockReturnValue({ width: 360, height: 800, fontScale: 2, scale: 1 });
  const props = fixture('balanced');
  await act(async () => { screen = TestRenderer.create(<TodayRecovery {...props} average="71.6" expanded onExpand={jest.fn()} onOpen={jest.fn()} theme={createTheme(dark)} />); });
  expect(copy().replace(/HRV|RHR|ms|bpm/g, '')).not.toMatch(/[A-Za-z٠-٩۰-۹٬٫]/);
  for (const testID of ['today-recovery-hero', 'today-contributor-strip']) {
    const element = screen.root.findAllByType(View).find((node) => node.props.testID === testID);
    expect(StyleSheet.flatten(element.props.style).flexDirection).toBe('column');
  }
});
