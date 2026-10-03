import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppIcon } from '../../components/AppIcon';
import { CompactState } from '../../components/ProductUI';
import { MovementBars, SleepComposition } from '../../components/SignalVisuals';
import { getLocale, tr } from '../../localization/i18n';
import { Pressable, Text, View } from '../../localization/LocalizedNative';
import type { BaselineResult } from '../../models/baseline';
import type { RecoveryResult } from '../../models/recovery';
import type { TrendPoint, TrendReport } from '../../models/trends';
import type { DashboardDayData } from '../../services/DashboardDataService';
import type { AppTheme } from '../../theme/theme';
import type { MetricRoute } from './metricDetailModel';
import { detailMeta, formatDetailValue } from './metricDetailPresentation';

type History = { points: TrendPoint[]; report: TrendReport };

/** Metric-specific day context. These are recorded observations, never invented goals. */
export function MetricDayContext({ day, history, metric, singleColumn, theme }: { day: DashboardDayData; history: History; metric: MetricRoute; singleColumn: boolean; theme: AppTheme }) {
  const styles = useMemo(() => createStyles(theme, singleColumn), [singleColumn, theme]);
  const summary = day.summary;
  if (!summary) return <CompactState icon={detailMeta(metric).icon} title={tr('common.noDayReading')} theme={theme} />;
  if (metric === 'recovery') return <RecoveryContributors recovery={day.recovery} styles={styles} theme={theme} />;
  if (metric === 'sleep' && summary.sleep.status === 'available') {
    const sleep = summary.sleep.value;
    return <View testID="day-context-sleep">
      <View style={styles.nightPanel}>
        <View style={styles.sleepTiming}>
          <View style={styles.timeCell}><Text style={styles.caption}>{tr('detail.bedtime')}</Text><Text style={styles.timeValue}>{formatClock(sleep.bedtime, summary.timeZone)}</Text></View>
          <AppIcon color={theme.colors.sleep} name="sleep" size={24} />
          <View style={styles.timeCell}><Text style={styles.caption}>{tr('detail.wake')}</Text><Text style={styles.timeValue}>{formatClock(sleep.wakeTime, summary.timeZone)}</Text></View>
        </View>
        <SleepComposition sleep={sleep} theme={theme} />
        <View style={styles.sleepFacts}><Fact label={tr('detail.inBed')} value={formatDetailValue('sleep', sleep.timeInBedMinutes)} styles={styles} /><Fact label={tr('today.sleepScore')} value={sleep.score === undefined ? tr('common.notReported') : `${sleep.score} / 100`} styles={styles} /></View>
      </View>
      <PersonalRange baseline={day.baselines?.sleepDuration} metric="sleep" singleColumn={singleColumn} styles={styles} theme={theme} />
      <View style={styles.consistency}><Text style={styles.caption}>{tr('format.bedtimePeriod', { count: history.report.days })}</Text><Text style={styles.consistencyValue}>{history.report.sleepConsistency.currentMeanDeviationMinutes === undefined ? tr('detail.bedtimeMore') : `${formatNumber(history.report.sleepConsistency.currentMeanDeviationMinutes)} min typical variation`}</Text><Text style={styles.note}>{tr('format.bedtimeCount', { count: history.report.sleepConsistency.currentAvailableDays })}</Text></View>
    </View>;
  }
  if (metric === 'hrv' && summary.hrv.status === 'available') return <View testID="day-context-hrv">
    <PersonalRange baseline={day.baselines?.hrv} metric="hrv" singleColumn={singleColumn} styles={styles} theme={theme} />
    <View style={styles.facts}><Fact label={tr('detail.low')} value={`${formatNumber(summary.hrv.value.minimumRmssdMs)} ms`} styles={styles} /><Fact label={tr('detail.high')} value={`${formatNumber(summary.hrv.value.maximumRmssdMs)} ms`} styles={styles} /><Fact label={tr('insights.observations')} value={String(summary.hrv.value.observationCount)} styles={styles} /></View>
    <Text style={styles.note}>{tr('detail.rmssd')}</Text>
  </View>;
  if (metric === 'rhr' && summary.heartRate.status === 'available') return <View testID="day-context-rhr">
    <PersonalRange baseline={day.baselines?.restingHeartRate} metric="rhr" singleColumn={singleColumn} styles={styles} theme={theme} />
    <Text style={styles.subheading}>{tr('detail.allHeart')}</Text>
    <View style={styles.facts}><Fact label={tr('detail.low')} value={`${formatNumber(summary.heartRate.value.minimumBpm)} bpm`} styles={styles} /><Fact label={tr('detail.dailyAverage')} value={`${formatNumber(summary.heartRate.value.averageBpm)} bpm`} styles={styles} /><Fact label={tr('detail.high')} value={`${formatNumber(summary.heartRate.value.maximumBpm)} bpm`} styles={styles} /></View>
    <Text style={styles.note}>{tr('detail.heartNote')}</Text>
  </View>;
  if (metric === 'spo2' && summary.oxygenSaturation.status === 'available') {
    const oxygen = summary.oxygenSaturation.value;
    return <View testID="day-context-spo2"><ObservedSpan metric={metric} minimum={oxygen.minimumPercent} average={oxygen.averagePercent} maximum={oxygen.maximumPercent} styles={styles} theme={theme} /><Text style={styles.note}>{tr('format.oxygenCount', { count: oxygen.observationCount })}</Text></View>;
  }
  if (metric === 'stress' && summary.stress.status === 'available') {
    const stress = summary.stress.value;
    return <View testID="day-context-stress"><ObservedSpan metric={metric} minimum={stress.minimumIndex} average={stress.averageIndex} maximum={stress.maximumIndex} styles={styles} theme={theme} /><View style={styles.facts}><Fact label={tr('insights.observations')} value={String(stress.observationCount)} styles={styles} /></View><Text style={styles.note}>{tr('detail.stressNote')}</Text></View>;
  }
  if (metric === 'activity' && summary.activity.status === 'available') {
    const activity = summary.activity.value;
    const recent = history.points.filter((item) => item.date <= summary.date).slice(-7);
    return <View testID="day-context-activity">
      <View style={styles.movementPanel}><MovementBars color={theme.colors.activity} height={112} points={recent} selectedDate={summary.date} theme={theme} /><Text style={styles.note}>Daily steps · {formatDate(recent[0]?.date)}–{formatDate(summary.date)}</Text></View>
      <View style={styles.facts}><Fact label={tr('today.active')} value={activity.activeDurationMinutes === undefined ? tr('common.notReported') : `${formatNumber(activity.activeDurationMinutes)} min`} styles={styles} /><Fact label={tr('today.energy')} value={activity.activeEnergyKcal === undefined ? tr('common.notReported') : `${formatNumber(activity.activeEnergyKcal)} kcal`} styles={styles} /><Fact label={tr('today.workouts')} value={activity.workoutCount === undefined ? tr('common.notReported') : String(activity.workoutCount)} styles={styles} />{activity.distanceMeters !== undefined ? <Fact label={tr('detail.distance')} value={`${formatNumber(activity.distanceMeters / 1000)} km`} styles={styles} /> : null}</View>
    </View>;
  }
  const source = metric === 'sleep' ? summary.sleep : metric === 'hrv' ? summary.hrv : metric === 'rhr' ? summary.heartRate : metric === 'spo2' ? summary.oxygenSaturation : metric === 'stress' ? summary.stress : summary.activity;
  return <CompactState icon={detailMeta(metric).icon} title={source.status === 'unsupported' ? tr('state.notSupported') : source.status === 'query-failed' ? tr('common.readingUnavailable') : tr('common.noDayReading')} message={source.status !== 'available' && source.status !== 'query-failed' ? source.reason : undefined} theme={theme} />;
}

type Styles = ReturnType<typeof createStyles>;
function RecoveryContributors({ recovery, styles, theme }: { recovery: RecoveryResult | null; styles: Styles; theme: AppTheme }) {
  const [expansion, setExpansion] = useState<{ date: string | undefined; signal: string | null }>({ date: recovery?.evaluatedDate, signal: null });
  if (expansion.date !== recovery?.evaluatedDate) setExpansion({ date: recovery?.evaluatedDate, signal: null });
  const expanded = expansion.date === recovery?.evaluatedDate ? expansion.signal : null;
  return <View testID="day-context-recovery">{recovery?.contributions.map((item) => {
    const label = item.signal === 'hrv-rmssd' ? tr('metric.hrv') : item.signal === 'resting-heart-rate' ? tr('metric.rhr') : tr('metric.sleep');
    const fullName = item.signal === 'hrv-rmssd' ? tr('metric.hrvFull') : item.signal === 'resting-heart-rate' ? tr('metric.rhrFull') : tr('metric.sleepDuration');
    const icon = item.signal === 'hrv-rmssd' ? 'hrv' : item.signal === 'resting-heart-rate' ? 'heart' : 'sleep';
    const impact = item.impactFromNeutral;
    const relation = item.relation === 'above-range' ? tr('range.above') : item.relation === 'below-range' ? tr('range.below') : item.relation === 'within-range' ? tr('state.inRange') : item.reason;
    const value = (amount?: number) => amount === undefined ? tr('common.notAvailable') : item.unit === 'minutes' ? formatDetailValue('sleep', amount) : `${formatNumber(amount)} ${item.unit}`;
    const weight = tr(item.normalizedWeight === undefined ? 'format.configuredWeight' : 'format.configuredApplied', { count: Math.round(item.configuredWeight * 100), applied: Math.round((item.normalizedWeight ?? 0) * 100) });
    const open = expanded === item.signal;
    return <View key={item.signal} style={styles.contributor}>
      <Pressable accessibilityLabel={`${fullName}, ${value(item.currentValue)}, ${relation}, ${weight}`} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setExpansion({ date: recovery?.evaluatedDate, signal: open ? null : item.signal })} style={({ pressed }) => [styles.contributorButton, pressed && styles.pressed]}>
        <View style={styles.contributorHeadline}><View style={styles.contributorIdentity}><AppIcon color={item.signal === 'sleep-duration' ? theme.colors.sleep : theme.colors.accent} name={icon} size={20} /><Text style={styles.contributorLabel}>{label}</Text></View><Text style={styles.contributorValue}>{value(item.currentValue)}</Text><Text style={styles.expand}>{open ? '−' : '+'}</Text></View>
        <View style={styles.contributorContext}><Text style={styles.contributorRelation}>{relation}</Text><Text style={styles.impactValue}>{impact === undefined ? tr('common.notScored') : tr('format.impact', { amount: `${impact > 0 ? '+' : ''}${formatNumber(impact)}` })}</Text></View>
        <View style={styles.influenceTrack}><View style={styles.neutralMarker} />{impact !== undefined ? <View style={[styles.influence, { width: `${Math.min(50, Math.abs(impact))}%`, [impact >= 0 ? 'start' : 'end']: '50%' }]} /> : null}</View>
      </Pressable>
      {open ? <View style={styles.contributorFacts}><Text style={styles.note}>Baseline {value(item.baselineCenter)}{item.lowerBound !== undefined && item.upperBound !== undefined ? ` · ${value(item.lowerBound)}–${value(item.upperBound)}` : ''}</Text><Text style={styles.note}>{weight}</Text></View> : null}
    </View>;
  })}{!recovery?.contributions.length ? <Text style={styles.body}>{tr('detail.moreContributors')}</Text> : null}</View>;
}

function PersonalRange({ baseline, metric, singleColumn, styles, theme }: { baseline?: BaselineResult; metric: 'sleep' | 'hrv' | 'rhr'; singleColumn: boolean; styles: Styles; theme: AppTheme }) {
  if (!baseline || baseline.status !== 'ready' || baseline.lowerBound === undefined || baseline.upperBound === undefined) return <View style={styles.rangeLearning}><AppIcon name="trends" color={theme.colors.textMuted} size={20} /><View style={{ flex: 1 }}><Text style={styles.caption}>{tr('detail.personalReference')}</Text><Text style={styles.body}>{baseline?.status === 'learning' ? `${baseline.validSampleCount} of ${baseline.requiredSampleCount} valid days · learning your range` : tr('detail.moreHistory')}</Text></View></View>;
  const lower = baseline.lowerBound, upper = baseline.upperBound;
  const span = Math.max(upper - lower, Math.abs(upper) * 0.08, 1);
  const minimum = Math.min(lower - span * 0.6, baseline.currentValue ?? lower), maximum = Math.max(upper + span * 0.6, baseline.currentValue ?? upper);
  const position = (value: number) => Math.max(0, Math.min(100, (value - minimum) / (maximum - minimum) * 100));
  return <View style={styles.personalRange}>
    <View style={styles.rangeHeader}><Text style={styles.caption}>{tr('detail.recentRange')}</Text><Text style={styles.note}>{baseline.validSampleCount} valid days</Text></View>
    {singleColumn ? <View style={{ gap: 10 }}><Fact label={tr('detail.minimum')} value={formatDetailValue(metric, lower)} styles={styles} /><Fact label={tr('detail.maximum')} value={formatDetailValue(metric, upper)} styles={styles} /></View> : <Text style={styles.rangeValue}>{formatDetailValue(metric, lower)}–{formatDetailValue(metric, upper)}</Text>}
    <View style={styles.rangeTrack}><View style={[styles.rangeBand, { start: `${position(lower)}%`, width: `${position(upper) - position(lower)}%` }]} />{baseline.currentValue !== undefined ? <View accessibilityLabel={tr('format.observationDay', { value: formatDetailValue(metric, baseline.currentValue) })} style={[styles.rangeMarker, { start: `${Math.max(1.5, Math.min(98.5, position(baseline.currentValue)))}%` }]} /> : null}</View>
    <Text style={styles.note}>Range from the {baseline.lookbackDays} days before this date</Text>
  </View>;
}

/** The rail spans the day's recorded minimum/maximum, not a population threshold. */
function ObservedSpan({ metric, minimum, average, maximum, styles, theme }: { metric: 'spo2' | 'stress'; minimum: number; average: number; maximum: number; styles: Styles; theme: AppTheme }) {
  const position = maximum === minimum ? 50 : Math.max(0, Math.min(100, (average - minimum) / (maximum - minimum) * 100));
  return <View testID={`observed-span-${metric}`} style={styles.observedSpan}>
    {metric === 'stress' ? <Text style={styles.caption}>{tr('detail.observationRange')}</Text> : null}
    <View accessible accessibilityLabel={`${tr('detail.minimum')} ${formatDetailValue(metric, minimum)}. ${tr('detail.dailyAverage')} ${formatDetailValue(metric, average)}. ${tr('detail.maximum')} ${formatDetailValue(metric, maximum)}`} style={styles.observedRail}>
      <View testID="observed-average-marker" style={[styles.observedMarker, { start: `${Math.max(1.5, Math.min(98.5, position))}%`, backgroundColor: theme.colors.accent }]} />
    </View>
    <View style={styles.spanEnds}><View style={styles.spanEnd}><Text style={styles.caption}>{tr('detail.minimum')}</Text><Text style={styles.spanValue}>{formatDetailValue(metric, minimum)}</Text></View><View style={styles.spanEnd}><Text style={styles.caption}>{tr('detail.maximum')}</Text><Text style={styles.spanValue}>{formatDetailValue(metric, maximum)}</Text></View></View>
  </View>;
}

function Fact({ label, value, styles }: { label: string; value: string; styles: Styles }) { return <View style={styles.fact}><Text style={styles.caption}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>; }
function formatNumber(value: number) { return new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(value); }
function formatDate(date?: string) { return date ? new Intl.DateTimeFormat(getLocale(), { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00Z`)) : ''; }
function formatClock(timestamp: string | undefined, timeZone: string) { return timestamp ? new Intl.DateTimeFormat(getLocale(), { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp)) : tr('common.notReported'); }
function createStyles(theme: AppTheme, singleColumn: boolean) { return StyleSheet.create({
  caption: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, fontWeight: '500' }, note: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 18 }, body: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 5 }, pressed: { opacity: 0.6 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingVertical: 18 }, fact: { flexGrow: 1, flexBasis: singleColumn ? '100%' : '25%', minWidth: 96 }, factValue: { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left', color: theme.colors.text, fontSize: 22, lineHeight: 29, fontWeight: '600', marginTop: 4, fontVariant: ['tabular-nums'] },
  contributor: { marginBottom: 8 }, contributorButton: { minHeight: 48, paddingVertical: 10 }, contributorHeadline: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, contributorIdentity: { alignItems: 'center', flexDirection: 'row', flexGrow: 1, gap: 8 }, contributorLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '600' }, contributorValue: { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left', color: theme.colors.text, fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] }, expand: { color: theme.colors.textMuted, fontSize: 20 }, contributorContext: { flexDirection: singleColumn ? 'column' : 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 5, marginTop: 6 }, contributorRelation: { color: theme.colors.textSecondary, flexShrink: 1, fontSize: 12, lineHeight: 18 }, impactValue: { color: theme.colors.accent, fontSize: 11, lineHeight: 18, fontWeight: '600' }, influenceTrack: { direction: 'ltr', backgroundColor: theme.colors.surfaceMuted, borderRadius: 3, height: 4, marginTop: 10, overflow: 'hidden' }, neutralMarker: { backgroundColor: theme.colors.textMuted, height: 4, start: '50%', position: 'absolute', width: 1 }, influence: { backgroundColor: theme.colors.accentMuted, borderRadius: 3, height: 4, position: 'absolute' }, contributorFacts: { borderStartColor: theme.colors.border, borderStartWidth: 2, paddingStart: 12, paddingBottom: 10, gap: 4 },
  nightPanel: { backgroundColor: theme.colors.surface, borderRadius: 22, padding: 18 }, sleepTiming: { alignItems: singleColumn ? 'flex-start' : 'center', flexDirection: singleColumn ? 'column' : 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 }, timeCell: { flexShrink: 1 }, timeValue: { color: theme.colors.text, fontSize: 25, fontWeight: '600', marginTop: 3 }, sleepFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 20 }, consistency: { borderStartColor: theme.colors.sleep, borderStartWidth: 2, marginTop: 20, paddingStart: 12, gap: 4 }, consistencyValue: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  personalRange: { paddingTop: 14, paddingBottom: 4 }, rangeHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', marginBottom: 6 }, rangeLearning: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, paddingVertical: 14 }, rangeValue: { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left', color: theme.colors.text, fontSize: 23, fontWeight: '600', fontVariant: ['tabular-nums'] }, rangeTrack: { direction: 'ltr', backgroundColor: theme.colors.surfaceMuted, borderRadius: 7, height: 12, marginVertical: 14 }, rangeBand: { backgroundColor: theme.colors.accentSoft, borderRadius: 7, height: 12, position: 'absolute' }, rangeMarker: { backgroundColor: theme.colors.accent, borderColor: theme.colors.background, borderRadius: 6, borderWidth: 2, height: 22, marginStart: -5, position: 'absolute', top: -5, width: 10 }, subheading: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 20 },
  observedSpan: { paddingTop: 5, paddingBottom: 16 }, observedRail: { direction: 'ltr', backgroundColor: theme.colors.accentSoft, borderRadius: 4, height: 8, marginTop: 18, marginBottom: 18 }, observedMarker: { borderColor: theme.colors.background, borderWidth: 2, borderRadius: 9, width: 16, height: 16, marginStart: -8, position: 'absolute', top: -4 }, spanEnds: { direction: 'ltr', flexDirection: singleColumn ? 'column' : 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }, spanEnd: { minWidth: 110 }, spanValue: { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left', color: theme.colors.text, fontSize: 24, fontWeight: '600', marginTop: 4, fontVariant: ['tabular-nums'] },
  movementPanel: { backgroundColor: theme.colors.surface, borderRadius: 20, padding: 18, gap: 12 },
}); }
