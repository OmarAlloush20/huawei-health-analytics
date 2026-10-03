import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Pressable, Text, View } from '../../localization/LocalizedNative';
import { tr } from '../../localization/i18n';
import { RecoveryGauge } from '../../components/SignalVisuals';
import type { RecoveryResult } from '../../models/recovery';
import type { AppTheme } from '../../theme/theme';
import { formatNumber, formatSleepDuration } from '../../shared/formatters/healthFormatters';
import type { RecoveryDisplay } from './dashboardViewModel';
import { contributionContext, contributionWeight, getTodayRecoveryLayout } from './todayPresentation';

export function TodayRecovery({ recovery, presentation, average, expanded, onExpand, onOpen, theme }: {
  recovery: RecoveryResult | null | undefined; presentation: RecoveryDisplay; average?: string;
  expanded: boolean; onExpand(): void; onOpen(metric: 'recovery' | 'hrv' | 'rhr' | 'sleep'): void; theme: AppTheme;
}) {
  const { width, fontScale } = useWindowDimensions();
  const layout = getTodayRecoveryLayout(width, fontScale);
  const styles = useMemo(() => createStyles(theme, layout.stack, layout.contributorsStack), [theme, layout.stack, layout.contributorsStack]);
  const scored = recovery?.score !== undefined;
  const state = recovery?.category ? tr(`recovery.${recovery.category}`) : presentation.state === 'learning' ? tr('today.learning') : tr('today.notEnough');
  return <View style={styles.canvas} testID="today-recovery-canvas">
    <Pressable testID="today-recovery-hero" accessibilityRole="button" accessibilityLabel={`${presentation.title}. ${presentation.category ?? tr('metric.recovery')}. ${presentation.completeness ?? presentation.detail}. View details`} onPress={() => onOpen('recovery')} style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
      <RecoveryGauge score={recovery?.score} size={layout.gauge} theme={theme} />
      <View style={styles.copy}><Text style={styles.eyebrow}>{tr('today.state')}</Text><Text style={styles.title}>{state}</Text>
        <View style={styles.completeness}><Text style={styles.meta}>{scored ? tr('today.signalsUsed', { count: recovery!.usableSignalCount }) : presentation.detail}</Text>{scored ? <Text style={styles.coverage}>{formatNumber(recovery!.completenessPercent)}% {tr('common.coverage')}</Text> : null}</View>
        {scored && average ? <Text style={styles.reference}>{tr('format.recentAverage', { value: average })}</Text> : null}
        <Text style={styles.link}>{tr('common.details')} ›</Text>
      </View>
    </Pressable>
    {recovery?.contributions.length ? <View style={styles.contributors} testID="today-contributor-strip">{recovery.contributions.map((item) => {
      const metric = item.signal === 'hrv-rmssd' ? 'hrv' : item.signal === 'resting-heart-rate' ? 'rhr' : 'sleep';
      const label = tr(metric === 'hrv' ? 'metric.hrv' : metric === 'rhr' ? 'metric.rhr' : 'metric.sleep');
      const full = tr(metric === 'hrv' ? 'metric.hrvFull' : metric === 'rhr' ? 'metric.rhrFull' : 'metric.sleep');
      const value = item.currentValue === undefined ? tr('common.noReading') : item.unit === 'minutes' ? formatSleepDuration(Math.round(item.currentValue)) : `${formatNumber(item.currentValue)} ${item.unit}`;
      const impact = item.impactFromNeutral === undefined ? tr(item.status === 'baseline-learning' ? 'common.learning' : 'common.notScored') : `${item.impactFromNeutral > 0 ? '+' : ''}${formatNumber(item.impactFromNeutral)} pts`;
      return <Pressable key={item.signal} testID={`today-contributor-${metric}`} accessibilityRole="button" accessibilityLabel={`${full}, ${value}, ${impact}, ${contributionWeight(item)}, ${contributionContext(item)}`} onPress={() => onOpen(metric)} style={({ pressed }) => [styles.contributor, pressed && styles.pressed]}>
        <Text style={styles.contributorLabel}>{label}</Text><Text style={styles.value}>{value}</Text><Text style={styles.impact}>{impact}</Text>
        <View style={styles.track}><View style={{ width: `${Math.max(0, Math.min(100, item.signalScore ?? 0))}%`, height: 3, borderRadius: 3, backgroundColor: item.status === 'used' ? theme.colors.accent : theme.colors.border }} /></View>
      </Pressable>;
    })}</View> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onExpand} style={({ pressed }) => [styles.explanationToggle, pressed && styles.pressed]}><Text style={styles.toggleLabel}>{tr('today.shape')}</Text><Text style={styles.toggleAction}>{expanded ? tr('today.less') : tr('today.why')}</Text></Pressable>
    {expanded ? <View style={styles.explanation}>
      <Text style={styles.body}>{presentation.detail}</Text>
      <Text style={styles.explanationLabel}>{tr('today.modelDetails')}</Text>
      {recovery?.contributions.map((item) => <View key={item.signal} style={styles.rangeRow}><Text style={styles.rangeTitle}>{tr(item.signal === 'hrv-rmssd' ? 'metric.hrv' : item.signal === 'resting-heart-rate' ? 'metric.rhr' : 'metric.sleep')}</Text><Text style={styles.body}>{contributionWeight(item)}</Text><Text style={styles.rangeCopy}>{contributionContext(item)}</Text></View>)}
    </View> : null}
  </View>;
}
function createStyles(theme: AppTheme, stack: boolean, contributorsStack: boolean) { return StyleSheet.create({
  canvas: { backgroundColor: theme.colors.surface, borderRadius: 24, padding: 16, marginTop: 4 },
  hero: { flexDirection: stack ? 'column' : 'row', alignItems: 'center', gap: 12 },
  copy: { flex: stack ? undefined : 1, minWidth: 0, alignSelf: stack ? 'stretch' : undefined },
  eyebrow: { color: theme.colors.accent, fontSize: 11, fontWeight: '600' }, title: { color: theme.colors.text, fontSize: stack ? 27 : 21, fontWeight: '600', letterSpacing: -0.6, marginTop: 5 },
  completeness: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8, rowGap: 4, marginTop: 8 }, meta: { color: theme.colors.textSecondary, fontSize: 11, flexShrink: 1 }, coverage: { color: theme.colors.accent, fontSize: 11, fontVariant: ['tabular-nums'], fontWeight: '600' }, reference: { color: theme.colors.textMuted, fontSize: 10, marginTop: 5 }, link: { color: theme.colors.accent, fontSize: 11, fontWeight: '600', marginTop: 10 },
  contributors: { flexDirection: contributorsStack ? 'column' : 'row', flexWrap: 'wrap', gap: 12, paddingTop: 14, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  contributor: { flex: contributorsStack ? undefined : 1, minWidth: 76, minHeight: 48, paddingVertical: 3 }, contributorLabel: { color: theme.colors.textSecondary, fontSize: 10, fontWeight: '600' }, value: { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left', color: theme.colors.text, fontSize: 14, fontWeight: '600', marginTop: 5, fontVariant: ['tabular-nums'] }, impact: { color: theme.colors.textMuted, fontSize: 10, marginTop: 3 }, track: { direction: 'ltr', backgroundColor: theme.colors.surfaceMuted, height: 3, borderRadius: 3, marginTop: 7 },
  explanationToggle: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }, toggleLabel: { color: theme.colors.textSecondary, fontSize: 11, flexShrink: 1 }, toggleAction: { color: theme.colors.accent, fontSize: 11, fontWeight: '600' },
  explanation: { gap: 12, paddingTop: 4 }, explanationLabel: { color: theme.colors.text, fontSize: 12, fontWeight: '600' }, body: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 19 }, rangeRow: { gap: 4, paddingVertical: 8 }, rangeTitle: { color: theme.colors.accent, fontSize: 11, fontWeight: '600' }, rangeCopy: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 18 }, pressed: { opacity: 0.68 },
}); }
