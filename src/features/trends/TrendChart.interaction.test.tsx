import { createElement } from 'react';
// @ts-expect-error This installed renderer does not ship its TypeScript declarations.
import { act, create } from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';
import { publishLanguage } from '../../localization/i18n';

import type { TrendPoint } from '../../models/trends';
import { createTheme } from '../../theme/theme';
import { TrendChart } from './TrendChart';

const points: TrendPoint[] = [
  { date: '2026-09-26', status: 'available', value: 42.1234 },
  { date: '2026-09-27', status: 'missing' },
  { date: '2026-09-28', status: 'available', value: 45 },
];
const renderers: ReturnType<typeof create>[] = [];
const createChart = (element: Parameters<typeof create>[0]) => { const renderer = create(element); renderers.push(renderer); return renderer; };
afterEach(() => { act(() => { renderers.splice(0).forEach((renderer) => renderer.unmount()); publishLanguage('en'); }); jest.restoreAllMocks(); });

describe('Trend chart inspection', () => {
  test('touch, drag and release publish exact observations and scrub lifecycle', () => {
    const selection = jest.fn();
    const scrub = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = createChart(createElement(TrendChart, { points, theme: createTheme(true), unit: 'ms', accessibilityLabel: 'HRV history', onSelectionChange: selection, onScrubChange: scrub })); });
    const chart = () => renderer.root.findByProps({ accessibilityRole: 'adjustable' });
    act(() => { chart().props.onLayout({ nativeEvent: { layout: { width: 328 } } }); });
    act(() => { chart().props.onResponderGrant({ nativeEvent: { locationX: 0 } }); });
    expect(selection).toHaveBeenLastCalledWith(points[0]);
    expect(scrub).toHaveBeenLastCalledWith(true);
    expect(chart().props.accessibilityValue.text).toContain('42.1234 ms');
    act(() => { chart().props.onResponderMove({ nativeEvent: { locationX: 328 } }); });
    expect(selection).toHaveBeenLastCalledWith(points[2]);
    act(() => { chart().props.onResponderRelease(); });
    expect(scrub).toHaveBeenLastCalledWith(false);
    act(() => { renderer.unmount(); });
  });

  test('controlled historical date renders without firing callbacks and accessibility skips gaps', () => {
    const selection = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = createChart(createElement(TrendChart, { points, selectedDate: points[0].date, theme: createTheme(false), accessibilityLabel: 'HRV history', onSelectionChange: selection })); });
    const chart = renderer.root.findByProps({ accessibilityRole: 'adjustable' });
    expect(selection).not.toHaveBeenCalled();
    expect(chart.props.accessibilityValue.text).toContain('Sep 26');
    act(() => { chart.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }); });
    expect(selection).toHaveBeenLastCalledWith(points[2]);
    act(() => { renderer.unmount(); });
  });

  test('comparison announces missing same-day readings and clamps measured edge tooltip', () => {
    jest.spyOn(jest.requireActual('react-native'), 'useWindowDimensions').mockReturnValue({ width: 390, height: 780, scale: 1, fontScale: 1 });
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = createChart(createElement(TrendChart, { points, selectedDate: points[2].date, theme: createTheme(true), accessibilityLabel: 'Compared history', comparison: { points: [points[0]], label: 'Recovery', unit: 'pts' } })); });
    const chart = () => renderer.root.findByProps({ accessibilityRole: 'adjustable' });
    act(() => { chart().props.onLayout({ nativeEvent: { layout: { width: 328 } } }); });
    const tooltip = renderer.root.findAllByType(View).find((node: { props: { pointerEvents?: string; onLayout?: unknown } }) => node.props.pointerEvents === 'none' && node.props.onLayout);
    act(() => { tooltip.props.onLayout({ nativeEvent: { layout: { width: 284, height: 116 } } }); });
    const style = StyleSheet.flatten(tooltip.props.style);
    expect(style.start).toBe(44);
    expect(style.width).toBe(280);
    expect(style.maxWidth).toBe(320);
    expect(chart().props.accessibilityValue.text).toContain('Recovery: No reading this day');
    expect(StyleSheet.flatten(chart().props.style).height).toBeGreaterThanOrEqual(280);
    act(() => { renderer.unmount(); });
  });
  test('Arabic keeps chart chronology and tooltip coordinates LTR while translating accessibility', () => {
    const selection = jest.fn();
    let renderer: ReturnType<typeof create>;
    publishLanguage('ar');
    try {
      act(() => { renderer = createChart(createElement(TrendChart, { points, selectedDate: points[2].date, theme: createTheme(false), accessibilityLabel: 'HRV history', onSelectionChange: selection })); });
      const chart = () => renderer.root.findAllByType(View).find((node: { props: { accessibilityRole?: string } }) => node.props.accessibilityRole === 'adjustable');
      expect(StyleSheet.flatten(chart().props.style).direction).toBe('ltr');
      expect(chart().props.accessibilityLabel).toBe('سجل HRV');
      expect(chart().props.accessibilityValue.text).toContain('45');
      expect(chart().props.accessibilityValue.text).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
      act(() => { chart().props.onLayout({ nativeEvent: { layout: { width: 320 } } }); });
      act(() => { chart().props.onResponderGrant({ nativeEvent: { locationX: 0 } }); });
      expect(selection).toHaveBeenLastCalledWith(points[0]);
      act(() => { chart().props.onResponderMove({ nativeEvent: { locationX: 320 } }); });
      expect(selection).toHaveBeenLastCalledWith(points[2]);
    } finally { act(() => { renderer?.unmount(); }); publishLanguage('en'); }
  });
  test('explicit controlled null clears a prior tooltip instead of restoring internal inspection', () => {
    let renderer: ReturnType<typeof create>;
    const props = { points, theme: createTheme(false), accessibilityLabel: 'HRV history', unit: 'ms' };
    act(() => { renderer = createChart(createElement(TrendChart, props)); });
    const chart = () => renderer.root.findByProps({ accessibilityRole: 'adjustable' });
    act(() => { chart().props.onResponderGrant({ nativeEvent: { locationX: 0 } }); });
    expect(chart().props.accessibilityValue.text).toContain('42.1234 ms');
    act(() => { renderer.update(createElement(TrendChart, { ...props, selectedDate: null })); });
    expect(chart().props.accessibilityValue.text).toBe('2 recorded days');
    expect(renderer.root.findAllByType(View).filter((node: { props: { pointerEvents?: string; onLayout?: unknown } }) => node.props.pointerEvents === 'none' && node.props.onLayout)).toHaveLength(0);
    act(() => { renderer.unmount(); });
  });

  test('unrecorded history is a quiet, non-interactive gap rather than an invitation to scrub fabricated data', () => {
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = createChart(createElement(TrendChart, { points: [{ date: '2026-09-26', status: 'missing' }], theme: createTheme(true), accessibilityLabel: 'HRV history' })); });
    const chart = renderer.root.findByProps({ accessibilityRole: 'adjustable' });
    expect(chart.props.onStartShouldSetResponder()).toBe(false);
    expect(chart.props.accessibilityHint).toBeUndefined();
    expect(chart.props.accessibilityValue.text).toBe('0 recorded days');
    expect(StyleSheet.flatten(chart.props.style).height).toBeLessThan(280);
    expect(renderer.root.findAllByType(Svg)).toHaveLength(0);
    expect(renderer.root.findAll((node: { props: { children?: unknown } }) => node.props.children === 'Touch to inspect a day')).toHaveLength(0);
  });

  test.each([true, false].flatMap((dark) => ['en', 'ar'].flatMap((language) => [[360, 1], [390, 1], [412, 1], [600, 1], [360, 2], [390, 2], [412, 2], [600, 2]].map(([width, fontScale]) => [dark, language, width, fontScale] as const))))('bounded premium Compare overlay (dark=%s, %s, %idp, %sx) preserves real chronology', (dark, language, width, fontScale) => {
    jest.spyOn(jest.requireActual('react-native'), 'useWindowDimensions').mockReturnValue({ width, height: 780, scale: 1, fontScale });
    act(() => { publishLanguage(language as 'en' | 'ar'); });
    const selection = jest.fn();
    const chartWidth = width - (width < 390 ? 32 : 48);
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = createChart(createElement(TrendChart, { points, selectedDate: points[2].date, theme: createTheme(dark), unit: 'ms', accessibilityLabel: 'HRV history', onSelectionChange: selection, height: 336, comparison: { points: [points[0]], label: 'RHR', accessibilityLabel: 'Resting heart rate', unit: 'bpm' } })); });
    const chart = () => renderer.root.findByProps({ accessibilityRole: 'adjustable' });
    act(() => { chart().props.onLayout({ nativeEvent: { layout: { width: chartWidth } } }); });
    const tooltip = renderer.root.findAllByType(View).find((node: { props: { pointerEvents?: string; onLayout?: unknown } }) => node.props.pointerEvents === 'none' && node.props.onLayout);
    // The first frame is bounded, not only the frame after native measurement.
    let style = StyleSheet.flatten(tooltip.props.style);
    expect(style.start).toBeGreaterThanOrEqual(4);
    expect(style.start + style.width).toBeLessThanOrEqual(chartWidth - 4);
    const measuredHeight = fontScale === 2 ? 164 : 100;
    act(() => { tooltip.props.onLayout({ nativeEvent: { layout: { width: style.width, height: measuredHeight } } }); });
    style = StyleSheet.flatten(tooltip.props.style);
    const plot = renderer.root.findByType(Svg);
    expect(style.start + style.width).toBeLessThanOrEqual(chartWidth - 4);
    expect(style.top + measuredHeight).toBeLessThan(StyleSheet.flatten(plot.props.style).top);
    expect(StyleSheet.flatten(chart().props.style).height).toBeGreaterThanOrEqual(336);
    expect(StyleSheet.flatten(chart().props.style).direction).toBe('ltr');
    expect(chart().props.accessibilityValue.text).toContain('45 ms');
    expect(chart().props.accessibilityValue.text).not.toContain('. RHR:');
    expect(chart().props.accessibilityValue.text).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
    act(() => { chart().props.onResponderGrant({ nativeEvent: { locationX: 0 } }); });
    expect(selection).toHaveBeenLastCalledWith(points[0]);
    act(() => { chart().props.onResponderMove({ nativeEvent: { locationX: chartWidth } }); });
    expect(selection).toHaveBeenLastCalledWith(points[2]);
  });
});
