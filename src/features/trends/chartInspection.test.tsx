import { createElement } from 'react';
// @ts-expect-error This installed renderer does not ship its TypeScript declarations.
import { act, create } from 'react-test-renderer';
import { Pressable, View } from 'react-native';

import type { TrendPoint } from '../../models/trends';
import { createTheme } from '../../theme/theme';
import { ChartInspectionWorkspace, InspectionBoundary, useChartInspection } from './chartInspection';
import { TrendChart } from './TrendChart';

const points: TrendPoint[] = [{ date: '2026-09-26', status: 'available', value: 42 }, { date: '2026-09-27', status: 'missing' }, { date: '2026-09-28', status: 'available', value: 45 }];
function Harness({ identity = 'hrv-7d', history = points, onPress = () => {} }: { identity?: string; history?: TrendPoint[]; onPress?: () => void }) {
  const inspection = useChartInspection(identity, history);
  return <InspectionBoundary testID="boundary" onDismiss={inspection.resetSelection}>
    <ChartInspectionWorkspace testID="workspace"><TrendChart points={history} selectedDate={inspection.selectedPoint?.date ?? null} theme={createTheme(true)} accessibilityLabel="HRV history" onSelectionChange={inspection.onSelectionChange} onScrubChange={inspection.onScrubChange} /></ChartInspectionWorkspace>
    <Pressable testID="outside-control" onPress={onPress} />
  </InspectionBoundary>;
}

describe('centralized transient chart inspection', () => {
  test('workspace touches retain inspection; outside touches dismiss without taking control presses or scroll responders', () => {
    const press = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = create(createElement(Harness, { onPress: press })); });
    const chart = () => renderer.root.findByType(TrendChart);
    const native = (id: string) => renderer.root.findAllByType(View).find((node: { props: { testID?: string } }) => node.props.testID === id);
    act(() => { chart().props.onSelectionChange(points[0]); });
    expect(chart().props.selectedDate).toBe(points[0].date);
    const inside = { nativeEvent: { identifier: 0, timestamp: 1, target: 4 } };
    act(() => { native('workspace').props.onTouchStart(inside); native('boundary').props.onTouchStart(inside); });
    expect(chart().props.selectedDate).toBe(points[0].date);
    const outside = { nativeEvent: { identifier: 0, timestamp: 2, target: 5 }, preventDefault: jest.fn(), stopPropagation: jest.fn() };
    act(() => { native('boundary').props.onTouchStart(outside); });
    expect(chart().props.selectedDate).toBeNull();
    expect(native('boundary').props.onStartShouldSetResponder).toBeUndefined();
    expect(native('boundary').props.onStartShouldSetResponderCapture).toBeUndefined();
    expect(outside.preventDefault).not.toHaveBeenCalled();
    expect(outside.stopPropagation).not.toHaveBeenCalled();
    act(() => { renderer.root.findAll((node: { props: { testID?: string; onPress?: unknown } }) => node.props.testID === 'outside-control' && typeof node.props.onPress === 'function')[0].props.onPress(); });
    expect(press).toHaveBeenCalledTimes(1);
    act(() => { renderer.unmount(); });
  });

  test('workspace identity resets selection, and reading updates use the current observation without filling gaps', () => {
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = create(createElement(Harness)); });
    const chart = () => renderer.root.findByType(TrendChart);
    act(() => { chart().props.onSelectionChange(points[0]); });
    expect(chart().props.selectedDate).toBe(points[0].date);
    act(() => { renderer.update(createElement(Harness, { history: [{ ...points[0], value: 80 }, points[1], points[2]] })); });
    expect(renderer.root.findByProps({ accessibilityRole: 'adjustable' }).props.accessibilityValue.text).toContain('80');
    act(() => { chart().props.onSelectionChange(points[1]); });
    expect(chart().props.selectedDate).toBeNull();
    act(() => { chart().props.onSelectionChange(points[2]); });
    act(() => { renderer.update(createElement(Harness, { identity: 'hrv-30d' })); });
    expect(chart().props.selectedDate).toBeNull();
    act(() => { renderer.update(createElement(Harness, { identity: 'hrv-7d' })); });
    expect(chart().props.selectedDate).toBeNull();
    act(() => { renderer.unmount(); });
  });
});
