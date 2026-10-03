import { getLocale, tr } from '../localization/i18n';
import { Text, View } from '../localization/LocalizedNative';
import { useId } from 'react';
import { useWindowDimensions } from 'react-native';
import { Circle, Defs, LinearGradient, Path, Stop, Svg } from 'react-native-svg';

import type { SleepDailySummary } from '../models/health';
import type { TrendPoint } from '../models/trends';
import { formatSleepDuration } from '../shared/formatters/healthFormatters';
import type { AppTheme } from '../theme/theme';

export function RecoveryGauge({ score, theme, size = 164, label }: { score?: number; theme: AppTheme; size?: number; label?: string }) {
  const gradientId = useId().replace(/:/g, '');
  const { fontScale } = useWindowDimensions();
  const diameter = Math.min(280, size * Math.max(1, Math.min(fontScale, 1.8)));
  const radius = 65;
  const circumference = 2 * Math.PI * radius;
  const ratio = score === undefined ? 0 : Math.max(0, Math.min(100, score)) / 100;
  return <View accessible accessibilityLabel={label ?? (score === undefined ? tr('recovery.notScored') : `Recovery ${score} out of 100`)} style={{ alignItems: 'center', justifyContent: 'center', height: diameter, width: diameter }}>
    <Svg accessibilityElementsHidden height={diameter} importantForAccessibility="no" viewBox="0 0 164 164" width={diameter}>
      <Defs><LinearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1"><Stop offset="0" stopColor={theme.colors.accentStrong} /><Stop offset="1" stopColor={theme.colors.accent} /></LinearGradient></Defs>
      <Circle cx="82" cy="82" fill={theme.colors.surface} r="58" />
      <Circle cx="82" cy="82" fill="none" r={radius} stroke={theme.colors.surfaceMuted} strokeWidth="7" />
      <Circle cx="82" cy="82" fill="none" r="56" stroke={theme.colors.border} strokeWidth="0.5" strokeOpacity="0.55" />
      {score !== undefined ? <Circle cx="82" cy="82" fill="none" r={radius} rotation="-90" origin="82,82" stroke={`url(#${gradientId})`} strokeDasharray={`${circumference * ratio} ${circumference}`} strokeLinecap="round" strokeWidth="7" /> : <Circle cx="82" cy="82" fill="none" r={radius} stroke={theme.colors.border} strokeDasharray="4 8" strokeWidth="3" />}
    </Svg>
    <View pointerEvents="none" style={{ alignItems: 'center', position: 'absolute' }}><Text maxFontSizeMultiplier={2} style={{ color: theme.colors.text, fontSize: score === undefined ? 40 : Math.min(48, size * 0.3), fontVariant: ['tabular-nums'], fontWeight: '600', letterSpacing: -2 }}>{score ?? '—'}</Text><Text maxFontSizeMultiplier={2} style={{ color: theme.colors.textMuted, fontSize: 10, letterSpacing: 1.4 }}>{tr('recovery.gauge')}</Text></View>
  </View>;
}

export function Sparkline({ points, theme, width = 72, height = 28, color = theme.colors.accent }: { points: readonly TrendPoint[]; theme: AppTheme; width?: number; height?: number; color?: string }) {
  const values = points.flatMap((point) => point.status === 'available' && point.value !== undefined ? [point.value] : []);
  if (!values.length) return null;
  const minimum = Math.min(...values), span = Math.max(Math.max(...values) - minimum, 1);
  const segments: string[] = [];
  let path = '';
  const dots: { x: number; y: number }[] = [];
  points.forEach((point, index) => {
    if (point.status !== 'available' || point.value === undefined) { if (path) segments.push(path); path = ''; return; }
    const x = points.length === 1 ? width / 2 : 3 + index / (points.length - 1) * (width - 6);
    const y = height - 3 - (point.value - minimum) / span * (height - 6);
    dots.push({ x, y }); path += `${path ? ' L' : 'M'}${x} ${y}`;
  });
  if (path) segments.push(path);
  return <Svg accessibilityElementsHidden height={height} importantForAccessibility="no" viewBox={`0 0 ${width} ${height}`} width={width}>{segments.map((segment, index) => <Path key={index} d={segment} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />)}{dots.map((dot, index) => <Circle key={index} cx={dot.x} cy={dot.y} fill={color} r={index === dots.length - 1 ? 2.5 : 1.3} />)}</Svg>;
}

export function MovementBars({ points, theme, height = 64, color = theme.colors.activity, selectedDate }: { points: readonly TrendPoint[]; theme: AppTheme; height?: number; color?: string; selectedDate?: string }) {
  const { fontScale } = useWindowDimensions();
  const selected = selectedDate ?? points.at(-1)?.date;
  const available = (point: TrendPoint) => point.status === 'available' && point.value !== undefined && Number.isFinite(point.value);
  const maximum = Math.max(1, ...points.flatMap((point) => available(point) ? [point.value!] : []));
  const dateLabel = (date: string) => new Intl.DateTimeFormat(getLocale(), { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  const readings = points.map((point) => `${dateLabel(point.date)}: ${available(point) ? point.value : tr('common.noReading')}`).join('. ');
  return <View accessible accessibilityLabel={selected ? tr('movement.selectedA11y', { date: dateLabel(selected), readings }) : tr('format.activityA11y', { readings })} style={{ direction: 'ltr' }}>
    <View style={{ direction: 'ltr', gap: 7, flexDirection: 'row', height }}>{points.map((point) => {
      const active = point.date === selected, recorded = available(point);
      return <View key={point.date} style={{ alignItems: 'center', flex: 1, justifyContent: 'flex-end', height: '100%' }}>
        <View style={{ backgroundColor: theme.colors.surfaceMuted, borderRadius: 5, width: '68%', height: '100%', justifyContent: 'flex-end', overflow: 'hidden' }}>
          {recorded ? <View testID={`movement-bar-${point.date}`} style={{ backgroundColor: color, borderRadius: 5, height: Math.max(2, point.value! / maximum * height), opacity: active ? 1 : 0.5, width: '100%' }} /> : <View testID={`movement-gap-${point.date}`} style={{ backgroundColor: theme.colors.textMuted, height: 2, width: '100%' }} />}
        </View>
      </View>;
    })}</View>
    <View style={{ direction: 'ltr', flexDirection: 'row', gap: 7, paddingTop: 7, minHeight: 16 + 9 * fontScale }}>{points.map((point) => <View key={point.date} style={{ alignItems: 'center', flex: 1, gap: 4 }}>
      <Text style={{ color: point.date === selected ? color : theme.colors.textMuted, fontSize: 9, fontWeight: point.date === selected ? '700' : '400' }}>{new Intl.DateTimeFormat(getLocale(), { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(`${point.date}T12:00:00Z`))}</Text>
      <View style={{ width: point.date === selected ? 12 : 0, height: 2, borderRadius: 2, backgroundColor: color }} />
    </View>)}</View>
  </View>;
}

export function SleepComposition({ sleep, theme, compact = false }: { sleep: SleepDailySummary; theme: AppTheme; compact?: boolean }) {
  const { fontScale } = useWindowDimensions();
  const stages = [{ label: tr('sleep.deep'), value: sleep.deepMinutes, color: theme.colors.accentStrong }, { label: tr('sleep.rem'), value: sleep.remMinutes, color: theme.colors.sleep }, { label: tr('sleep.light'), value: sleep.lightMinutes, color: theme.colors.accentMuted }, { label: tr('sleep.awake'), value: sleep.awakeMinutes, color: theme.colors.textMuted }];
  const unreported = Math.max(0, sleep.timeInBedMinutes - stages.reduce((total, stage) => total + stage.value, 0));
  if (unreported > 0) stages.push({ label: tr('sleep.unreported'), value: unreported, color: theme.colors.border });
  return <View>
    <View accessible accessibilityLabel={tr('format.sleepA11y', { stages: stages.map((stage) => tr('format.stageMinutes', { stage: stage.label, amount: stage.value })).join('. ') })} style={{ direction: 'ltr', flexDirection: 'row', gap: 3, height: compact ? 16 : 24, marginVertical: 12 }}>
      {stages.map((stage) => <View testID={`sleep-stage-${stage.value}-${stage.label}`} key={stage.label} style={{ borderRadius: compact ? 4 : 6, backgroundColor: stage.color, flex: stage.value / Math.max(1, sleep.timeInBedMinutes) }} />)}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 }}>{stages.map((stage) => <View key={stage.label} style={{ flexDirection: 'row', alignItems: 'center', columnGap: 6, flexBasis: fontScale > 1.15 ? '100%' : '44%', flexGrow: 1 }}>
      <View style={{ backgroundColor: stage.color, borderRadius: 3, height: 6, width: 6, flexShrink: 0 }} />
      <Text style={{ color: theme.colors.textSecondary, fontSize: compact ? 10 : 11, flex: 1 }}>{stage.label}</Text>
      <Text style={{ color: theme.colors.text, fontSize: compact ? 10 : 12, fontWeight: '500', direction: 'ltr', writingDirection: 'ltr', fontVariant: ['tabular-nums'] }}>{formatSleepDuration(stage.value)}</Text>
    </View>)}</View>
  </View>;
}
