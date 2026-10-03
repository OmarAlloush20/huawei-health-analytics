import { getLocale, tr } from '../../localization/i18n';
import { Text, View } from '../../localization/LocalizedNative';
import { useId, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import type { TrendPoint } from '../../models/trends';
import type { AppTheme } from '../../theme/theme';
import { buildChartGeometry, clampTooltipLeft, comparisonPointForDate, selectNearestAvailablePoint, stepAvailablePoint } from './chartGeometry';
export { buildTrendChartSegments, clampTooltipLeft, comparisonPointForDate, selectNearestAvailablePoint, stepAvailablePoint } from './chartGeometry';

export interface TrendChartProps {
  points: readonly TrendPoint[];
  theme: AppTheme;
  accessibilityLabel: string;
  unit?: string;
  height?: number;
  showAxes?: boolean;
  /** null is an explicitly cleared controlled selection; undefined is uncontrolled. */
  selectedDate?: string | null;
  onSelectionChange?: (point: TrendPoint | null) => void;
  onScrubChange?: (active: boolean) => void;
  comparison?: { points: readonly TrendPoint[]; label: string; accessibilityLabel?: string; unit: string; color?: string };
}

export function TrendChart({ points, theme, accessibilityLabel, unit = '', height = 280, showAxes = true, selectedDate, onSelectionChange, onScrubChange, comparison }: TrendChartProps) {
  const { fontScale } = useWindowDimensions();
  const gradientId = useId().replace(/:/g, '');
  const [width, setWidth] = useState(300);
  const [inspectedDate, setInspectedDate] = useState<string | null>(null);
  const [tooltipMeasurement, setTooltipMeasurement] = useState({ key: '', height: 0 });
  const leftInset = showAxes ? Math.min(width * 0.28, 48 * Math.min(fontScale, 2)) : 14;
  const rightInset = comparison && showAxes ? Math.min(width * 0.28, 48 * Math.min(fontScale, 2)) : 18;
  const plotWidth = Math.max(1, width - leftInset - rightInset);
  const tooltipWidth = Math.min(Math.max(1, width - 8), (comparison ? 280 : 172) * Math.max(1, fontScale));
  const tooltipLayoutKey = `${width}-${fontScale}-${comparison?.label ?? 'single'}`;
  const headerHeight = Math.max(comparison ? Math.max(92, 56 * fontScale + 26) : Math.max(66, 36 * fontScale + 22), tooltipMeasurement.key === tooltipLayoutKey ? tooltipMeasurement.height + 14 : 0);
  const footerHeight = showAxes ? (fontScale > 1.35 ? 46 : 34) * fontScale : 10;
  const plotHeight = Math.max(140, height - headerHeight - footerHeight);
  const model = useMemo(() => buildChartGeometry(points, plotWidth, plotHeight), [points, plotWidth, plotHeight]);
  const comparisonPoints = useMemo(() => comparison ? points.map((point) => comparison.points.find((candidate) => candidate.date === point.date) ?? { date: point.date, status: 'missing' as const }) : [], [comparison, points]);
  const secondary = useMemo(() => buildChartGeometry(comparisonPoints, plotWidth, plotHeight), [comparisonPoints, plotWidth, plotHeight]);
  const selected = model.dots.find((dot) => dot.point.date === (selectedDate !== undefined ? selectedDate : inspectedDate)) ?? null;
  const secondPoint = selected && comparison ? comparisonPointForDate(comparison.points, selected.point.date) : null;
  const secondaryDot = secondPoint ? secondary.dots.find((dot) => dot.point.date === secondPoint.date) : null;
  const secondaryColor = comparison?.color ?? theme.colors.chartSecondary;
  const valueText = selected ? `${formatValue(selected.point.value)}${unit ? ` ${unit}` : ''}` : '';
  const select = (index: number | null) => {
    const point = index === null ? null : points[index];
    setInspectedDate(point?.date ?? null); onSelectionChange?.(point);
  };
  const inspect = (event: GestureResponderEvent) => select(selectNearestAvailablePoint(points, plotWidth, event.nativeEvent.locationX - leftInset));
  const finish = () => onScrubChange?.(false);

  return (
    <View accessible accessibilityRole="adjustable" accessibilityLabel={accessibilityLabel}
      accessibilityHint={model.dots.length ? tr('chart.hint') : undefined}
      accessibilityValue={{ text: selected ? `${formatDate(selected.point.date)}. ${valueText}${comparison ? `. ${comparison.accessibilityLabel ?? comparison.label}: ${secondPoint ? `${formatValue(secondPoint.value)} ${comparison.unit}` : tr('chart.noSecondary')}` : ''}` : `${model.dots.length} recorded days` }}
      accessibilityActions={[{ name: 'increment', label: tr('calendar.nextDay') }, { name: 'decrement', label: tr('calendar.previousDay') }]}
      onAccessibilityAction={(event) => select(stepAvailablePoint(points, selected?.index ?? null, event.nativeEvent.actionName === 'decrement' ? -1 : 1))}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => model.dots.length > 0} onMoveShouldSetResponder={() => model.dots.length > 0}
      onResponderGrant={(event) => { onScrubChange?.(true); inspect(event); }} onResponderMove={inspect}
      onResponderRelease={finish} onResponderTerminate={finish} onResponderTerminationRequest={() => false}
      style={[styles.container, { height: model.dots.length ? headerHeight + plotHeight + footerHeight : Math.max(128, 48 * fontScale + 48) }]}>
      {selected ? <View pointerEvents="none" onLayout={(event) => { const { height } = event.nativeEvent.layout; if (tooltipMeasurement.key !== tooltipLayoutKey || height !== tooltipMeasurement.height) setTooltipMeasurement({ key: tooltipLayoutKey, height }); }}
        style={[styles.tooltip, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border, width: tooltipWidth, maxWidth: Math.max(1, width - 8), start: clampTooltipLeft(width, selected.x + leftInset, tooltipWidth) }]}>
        <Text style={[styles.tooltipDate, { color: theme.colors.textSecondary }]}>{formatDate(selected.point.date)}</Text>
        <Text style={[styles.tooltipValue, { color: theme.colors.accent }]}>{valueText}</Text>
        {comparison ? <View style={styles.tooltipComparison}><Text style={[styles.secondaryLabel, { color: secondaryColor }]}>{comparison.label}</Text><Text style={[styles.secondaryValue, { color: secondaryColor }]}>{secondPoint ? `${formatValue(secondPoint.value)} ${comparison.unit}` : tr('common.noReading')}</Text></View> : null}
      </View> : model.dots.length ? <View pointerEvents="none" style={styles.hint}><View style={[styles.hintDot, { backgroundColor: theme.colors.accentMuted }]} /><Text style={[styles.hintText, { color: theme.colors.textMuted }]}>{tr('chart.touch')}</Text></View> : null}
      {model.dots.length ? <Svg pointerEvents="none" height={plotHeight + 8} style={{ top: headerHeight, position: 'absolute' }} width={width} viewBox={`0 0 ${width} ${plotHeight + 8}`}>
        <Defs><LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={theme.colors.accentStrong} stopOpacity="0.24" /><Stop offset="1" stopColor={theme.colors.accentStrong} stopOpacity="0.015" /></LinearGradient></Defs>
        <G x={leftInset} y={4}>
          {[0, 0.5, 1].map((fraction) => <Line key={fraction} x1={0} x2={plotWidth} y1={fraction * plotHeight} y2={fraction * plotHeight} stroke={theme.colors.border} strokeOpacity={fraction === 1 ? 0.6 : 0.34} strokeDasharray={fraction === 1 ? undefined : '2 5'} />)}
          {model.bands.map((path, index) => <Path key={`band-${index}`} d={path} fill={theme.colors.accentMuted} fillOpacity={theme.dark ? '0.16' : '0.12'} />)}
          {model.areas.map((path, index) => <Path key={`fill-${index}`} d={path} fill={`url(#${gradientId})`} />)}
          {model.paths.map((path, index) => <Path key={`line-${index}`} d={path} fill="none" stroke={theme.colors.accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
          {model.dots.filter(() => points.length <= 14 || model.dots.length <= 5).map((dot) => <Circle key={dot.point.date} cx={dot.x} cy={dot.y} r="2.5" fill={theme.colors.accent} />)}
          {secondary.paths.map((path, index) => <Path key={`second-${index}`} d={path} fill="none" stroke={secondaryColor} strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" />)}
          {secondary.dots.filter(() => secondary.dots.length <= 5).map((dot) => <Circle key={`secondary-${dot.point.date}`} cx={dot.x} cy={dot.y} r="2.5" fill={secondaryColor} />)}
          {selected ? <><Line x1={selected.x} x2={selected.x} y1={0} y2={plotHeight} stroke={theme.colors.textSecondary} strokeOpacity="0.45" strokeDasharray="3 5" /><Circle cx={selected.x} cy={selected.y} r="10" fill={theme.colors.accent} fillOpacity="0.12" /><Circle cx={selected.x} cy={selected.y} r="5.5" fill={theme.colors.background} stroke={theme.colors.accent} strokeWidth="2.5" />{secondaryDot ? <Circle cx={secondaryDot.x} cy={secondaryDot.y} r="5" fill={theme.colors.background} stroke={secondaryColor} strokeWidth="2" /> : null}</> : null}
        </G>
      </Svg> : null}
      {showAxes && model.dots.length ? <>
        {model.ticks.map((value, index) => <Text pointerEvents="none" key={`axis-${index}`} style={[styles.axis, { color: theme.colors.textMuted, start: 0, width: leftInset - 6, top: headerHeight + 4 + index * plotHeight / 2 - 7 * fontScale }]}>{formatAxisValue(value)}</Text>)}
        {comparison ? secondary.ticks.map((value, index) => <Text pointerEvents="none" key={`secondary-axis-${index}`} style={[styles.axis, { color: secondaryColor, end: 0, width: rightInset - 6, textAlign: 'right', top: headerHeight + 4 + index * plotHeight / 2 - 7 * fontScale }]}>{formatAxisValue(value)}</Text>) : null}
        <View pointerEvents="none" style={[styles.dates, { top: headerHeight + plotHeight + 16, start: 0, end: 0 }]}><Text style={[styles.axisDate, { color: theme.colors.textMuted }]}>{shortDate(points[0]?.date)}</Text><Text style={[styles.axisDate, styles.lastDate, { color: theme.colors.textMuted }]}>{shortDate(points.at(-1)?.date)}</Text></View>
      </> : null}
      {!model.dots.length ? <Text style={[styles.noReading, { color: theme.colors.textMuted }]}>{tr('chart.noReadings')}</Text> : null}
    </View>
  );
}

function formatDate(date: string) { return new Intl.DateTimeFormat(getLocale(), { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)); }
function shortDate(date?: string) { return date ? new Intl.DateTimeFormat(getLocale(), { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) : ''; }
function formatValue(value?: number) { return value === undefined ? tr('common.noReading') : new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 20 }).format(value); }
function formatAxisValue(value: number) { return new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1, notation: Math.abs(value) >= 10000 ? 'compact' : 'standard' }).format(value); }
const styles = StyleSheet.create({
  container: { direction: 'ltr', position: 'relative', width: '100%' }, tooltip: { direction: 'ltr', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 13, paddingVertical: 10, position: 'absolute', top: 0 },
  tooltipValue: { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left', fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] }, tooltipDate: { fontSize: 11, textAlign: 'left', marginBottom: 4 }, tooltipComparison: { direction: 'ltr', flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 2, marginTop: 5 }, secondaryLabel: { flexShrink: 1, fontSize: 12, fontWeight: '600' }, secondaryValue: { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left', fontVariant: ['tabular-nums'], fontSize: 12, fontWeight: '600' },
  hint: { paddingTop: 18, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 7 }, hintDot: { height: 4, width: 4, borderRadius: 2, flexShrink: 0 }, hintText: { flexShrink: 1, fontSize: 11 }, axis: { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left', fontSize: 10, position: 'absolute', fontVariant: ['tabular-nums'] },
  dates: { direction: 'ltr', position: 'absolute', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, gap: 16 }, axisDate: { direction: 'ltr', textAlign: 'left', fontSize: 10, flex: 1, minWidth: 0 }, lastDate: { textAlign: 'right' }, noReading: { position: 'absolute', top: '50%', alignSelf: 'center', fontSize: 13 },
});
