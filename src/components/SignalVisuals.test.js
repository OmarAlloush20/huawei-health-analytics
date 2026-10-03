import React, { act } from 'react';
import { create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import * as Native from 'react-native';
import Svg, { Circle, LinearGradient } from 'react-native-svg';

import { getLocale, publishLanguage, tr } from '../localization/i18n';
import { formatSleepDuration } from '../shared/formatters/healthFormatters';
import { createTheme } from '../theme/theme';
import { MovementBars, RecoveryGauge, SleepComposition } from './SignalVisuals';

let screen;
let previousActFlag;
let warnings;
let dimensions;
beforeEach(() => {
  previousActFlag = global.IS_REACT_ACT_ENVIRONMENT;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  dimensions = jest.spyOn(jest.requireActual('react-native'), 'useWindowDimensions').mockReturnValue({ width: 360, height: 780, fontScale: 1, scale: 1 });
  const originalError = console.error;
  warnings = jest.spyOn(console, 'error').mockImplementation((...args) => { if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args); });
});
afterEach(async () => {
  await act(async () => screen?.unmount());
  screen = undefined;
  publishLanguage('en');
  dimensions.mockRestore();
  warnings.mockRestore();
  global.IS_REACT_ACT_ENVIRONMENT = previousActFlag;
});
async function render(element) { await act(async () => { screen = create(element); }); }
function first(id) { return screen.root.findAllByProps({ testID: id })[0]; }
function style(node) { return Native.StyleSheet.flatten(node.props.style); }
function text(node) { return typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : node?.children?.map(text).join(' ') ?? ''; }
function dateLabel(date) { return new Intl.DateTimeFormat(getLocale(), { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)); }

const movementPoints = [
  { date: '2026-09-24', status: 'available', value: 0 },
  { date: '2026-09-25', status: 'missing', value: 999 },
  { date: '2026-09-26', status: 'available', value: Number.NaN },
  { date: '2026-09-27', status: 'available', value: Number.POSITIVE_INFINITY },
  { date: '2026-09-28', status: 'not-recorded' },
  { date: '2026-09-29', status: 'available', value: 9754 },
];

test.each([true, false].flatMap((dark) => ['en', 'ar'].map((language) => [dark, language])))('Movement (dark=%s, %s) preserves chronological slots and distinguishes real zero from gaps', async (dark, language) => {
  publishLanguage(language);
  const theme = createTheme(dark);
  await render(<MovementBars points={movementPoints} selectedDate={movementPoints[0].date} height={90} theme={theme} />);
  expect(style(first('movement-bar-2026-09-24'))).toMatchObject({ height: 2, opacity: 1, backgroundColor: theme.colors.activity });
  expect(style(first('movement-bar-2026-09-29'))).toMatchObject({ height: 90, opacity: 0.5 });
  for (const date of ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28']) {
    expect(screen.root.findAllByProps({ testID: `movement-bar-${date}` })).toHaveLength(0);
    expect(style(first(`movement-gap-${date}`))).toMatchObject({ height: 2, backgroundColor: theme.colors.textMuted });
  }
  const ids = [...new Set(screen.root.findAll((node) => /^movement-(bar|gap)-/.test(node.props.testID ?? '')).map((node) => node.props.testID))];
  expect(ids).toEqual(movementPoints.map((point, index) => `movement-${index === 0 || index === 5 ? 'bar' : 'gap'}-${point.date}`));
  const accessible = screen.root.findAllByType(Native.View).find((node) => node.props.accessible);
  expect(style(accessible).direction).toBe('ltr');
  expect(accessible.props.accessibilityLabel).toContain(dateLabel(movementPoints[0].date));
  expect(accessible.props.accessibilityLabel).toContain(`${dateLabel(movementPoints[0].date)}: 0`);
  expect(accessible.props.accessibilityLabel).toContain('9754');
  expect(accessible.props.accessibilityLabel).not.toMatch(/NaN|Infinity|999|[\u0660-\u0669\u06f0-\u06f9]/);
  expect(screen.root.findAllByType(Native.Text).find((node) => style(node)?.fontWeight === '700').props.children).toBe(new Intl.DateTimeFormat(getLocale(), { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(`${movementPoints[0].date}T12:00:00Z`)));
});

test('Movement weekday rail grows independently of the plot at enlarged text sizes', async () => {
  const theme = createTheme(true);
  await render(<MovementBars points={movementPoints} theme={theme} height={70} />);
  const rail = () => screen.root.findAllByType(Native.View).find((node) => style(node)?.paddingTop === 7);
  expect(style(rail()).minHeight).toBe(25);
  dimensions.mockReturnValue({ width: 360, height: 780, fontScale: 2, scale: 1 });
  await act(async () => { screen.update(<MovementBars points={movementPoints} theme={theme} height={70} />); });
  expect(style(rail()).minHeight).toBe(34);
  expect(style(first('movement-bar-2026-09-29')).height).toBe(70);
});

const sleep = { bedtime: '2026-09-29T23:15:00Z', wakeTime: '2026-09-30T07:15:00Z', durationMinutes: 420, timeInBedMinutes: 480, deepMinutes: 90, remMinutes: 100, lightMinutes: 230, awakeMinutes: 20, score: 84 };

test.each([true, false].flatMap((dark) => ['en', 'ar'].map((language) => [dark, language])))('Sleep (dark=%s, %s) uses exact recorded stage proportions and an explicit unreported remainder', async (dark, language) => {
  publishLanguage(language);
  await render(<SleepComposition sleep={sleep} theme={createTheme(dark)} />);
  const expected = [['sleep.deep', 90], ['sleep.rem', 100], ['sleep.light', 230], ['sleep.awake', 20], ['sleep.unreported', 40]];
  for (const [key, minutes] of expected) {
    expect(style(first(`sleep-stage-${minutes}-${tr(key)}`)).flex).toBe(minutes / 480);
    expect(text(screen.toJSON())).toContain(formatSleepDuration(minutes));
  }
  const accessible = screen.root.findAllByType(Native.View).find((node) => node.props.accessible);
  expect(style(accessible).direction).toBe('ltr');
  expect(accessible.props.accessibilityLabel).toContain(tr('format.stageMinutes', { stage: tr('sleep.unreported'), amount: 40 }));
  expect(text(screen.toJSON())).not.toMatch(/[\u0660-\u0669\u06f0-\u06f9]/);
  expect([...new Set(screen.root.findAll((node) => /^sleep-stage-/.test(node.props.testID ?? '')).map((node) => node.props.testID))]).toHaveLength(5);
});

test('Sleep legends become full-width rows with enlarged text and omit a nonexistent remainder', async () => {
  const complete = { ...sleep, timeInBedMinutes: 440 };
  await render(<SleepComposition sleep={complete} theme={createTheme(false)} compact />);
  const legendRows = () => screen.root.findAllByType(Native.View).filter((node) => style(node)?.flexBasis !== undefined);
  expect(legendRows()).toHaveLength(4);
  expect(legendRows().every((node) => style(node).flexBasis === '44%')).toBe(true);
  expect(screen.root.findAll((node) => node.props.testID?.includes(tr('sleep.unreported')))).toHaveLength(0);
  dimensions.mockReturnValue({ width: 360, height: 780, fontScale: 2, scale: 1 });
  await act(async () => { screen.update(<SleepComposition sleep={complete} theme={createTheme(false)} compact />); });
  expect(legendRows().every((node) => style(node).flexBasis === '100%')).toBe(true);
  for (const node of screen.root.findAllByType(Native.Text)) expect(node.props.numberOfLines).toBeUndefined();
});

test.each([true, false])('Recovery (dark=%s) uses unique gradient IDs per gauge and retains exact score digits', async (dark) => {
  publishLanguage('ar');
  const theme = createTheme(dark);
  await render(<Native.View><RecoveryGauge score={71.6} theme={theme} /><RecoveryGauge score={64} theme={theme} /></Native.View>);
  const gradients = screen.root.findAllByType(LinearGradient).map((node) => node.props.id);
  expect(gradients).toHaveLength(2);
  expect(new Set(gradients).size).toBe(2);
  const strokes = screen.root.findAllByType(Circle).map((node) => node.props.stroke).filter((stroke) => stroke?.startsWith('url('));
  expect(strokes).toEqual(gradients.map((id) => `url(#${id})`));
  expect(text(screen.toJSON())).toContain('71.6');
  expect(text(screen.toJSON())).not.toMatch(/[\u0660-\u0669\u06f0-\u06f9]/);
});

test('Recovery geometry adapts to font scale without an unbounded diameter, and unavailable means no score arc', async () => {
  const theme = createTheme(true);
  await render(<RecoveryGauge theme={theme} size={164} />);
  expect(screen.root.findByType(Svg).props.width).toBe(164);
  expect(screen.root.findAllByType(Circle).some((node) => node.props.strokeDasharray === '4 8')).toBe(true);
  expect(screen.root.findAllByType(Circle).some((node) => node.props.stroke?.startsWith('url('))).toBe(false);
  dimensions.mockReturnValue({ width: 360, height: 780, fontScale: 2, scale: 1 });
  await act(async () => { screen.update(<RecoveryGauge theme={theme} size={164} score={0} />); });
  expect(screen.root.findByType(Svg).props.width).toBe(280);
  expect(screen.root.findAllByType(Circle).some((node) => node.props.stroke?.startsWith('url('))).toBe(true);
  expect(text(screen.toJSON())).toContain('0');
  for (const node of screen.root.findAllByType(Native.Text)) expect(node.props.maxFontSizeMultiplier).toBe(2);
});
