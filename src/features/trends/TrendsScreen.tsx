import { getLocale, tr } from '../../localization/i18n';
import { Text, View, Pressable } from '../../localization/LocalizedNative';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import type { BottomTabNavigationProp } from 'expo-router/js-tabs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appDependencies } from '../../appDependencies';
import { AppIcon, type AppIconName } from '../../components/AppIcon';
import { CompactState, Reveal, SectionLabel } from '../../components/ProductUI';
import type { TrendMetricId, TrendRangeId, TrendReport } from '../../models/trends';
import { DEFAULT_TRENDS_WORKSPACE, type TrendsWorkspace } from '../../repositories/ProductPreferencesRepository';
import { getSystemTimeZone } from '../../shared/dates/healthDates';
import { formatNumber, formatSleepDuration } from '../../shared/formatters/healthFormatters';
import type { AppTheme } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';
import { getResponsiveLayout } from '../../theme/responsive';
import { RangeSelector } from './RangeSelector';
import { TrendChart } from './TrendChart';
import { MetricPicker, type MetricPickerOption } from './MetricPicker';
import { buildTrendsViewModel } from './trendViewModel';
import { ChartInspectionWorkspace, InspectionBoundary, useChartInspection } from './chartInspection';
import { getTrendsPresentationLayout } from './trendsPresentationLayout';

const metricOrder: TrendMetricId[] = ['recovery', 'sleep-duration', 'hrv-rmssd', 'resting-heart-rate', 'steps'];
export function TrendsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<{ trends: undefined }>>();
  const { theme } = useAppTheme();
  const { width, fontScale } = useWindowDimensions();
  const { compact } = getResponsiveLayout(width, fontScale);
  const presentation = useMemo(() => getTrendsPresentationLayout(width, fontScale), [width, fontScale]);
  const styles = useMemo(() => createStyles(theme, compact, presentation), [compact, presentation, theme]);
  const [range, setRange] = useState<TrendRangeId>(DEFAULT_TRENDS_WORKSPACE.range);
  const [metric, setMetric] = useState<TrendMetricId>(DEFAULT_TRENDS_WORKSPACE.metric);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const workspace = useRef<TrendsWorkspace>({ ...DEFAULT_TRENDS_WORKSPACE });
  const workspaceWrite = useRef<Promise<void>>(Promise.resolve());
  const [metricPickerOpen, setMetricPickerOpen] = useState(false);
  const [compareMetric, setCompareMetric] = useState<TrendMetricId | null>(null);
  const [comparePickerOpen, setComparePickerOpen] = useState(false);
  const [report, setReport] = useState<TrendReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  useEffect(() => {
    let active = true;
    void appDependencies.getPersistence().then(async ({ productPreferences }) => {
      const saved = await productPreferences.getTrendsWorkspace();
      if (active) { workspace.current = saved; setMetric(saved.metric); setRange(saved.range); }
    }).catch(() => { /* Preferences are optional; a read failure must not erase them. */ }).finally(() => { if (active) setWorkspaceReady(true); });
    return () => { active = false; };
  }, []);
  const rememberWorkspace = (next: TrendsWorkspace) => {
    workspace.current = next;
    // Serialize rapid changes so an older write cannot finish after a newer choice.
    workspaceWrite.current = workspaceWrite.current.catch(() => {}).then(async () => {
      const { productPreferences } = await appDependencies.getPersistence();
      await productPreferences.setTrendsWorkspace(next);
    }).catch(() => { /* A preferences write never blocks chart use. */ });
  };
  const load = useCallback(async (nextRange: TrendRangeId, refresh = false) => {
    const id = ++request.current;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { dashboardService, trendsService } = await appDependencies.getPersistence();
      let stats = await dashboardService.getStats();
      stats = await dashboardService.bootstrapDevelopmentDataIfEmpty(stats);
      const next = stats.lastDate ? await trendsService.getReport(nextRange, stats.lastDate, stats.sync?.range?.timeZone ?? getSystemTimeZone()) : null;
      if (id === request.current) setReport(next);
    } catch {
      if (id === request.current) setError(tr('error.history'));
    } finally {
      if (id === request.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  const viewModel = report ? buildTrendsViewModel(report) : null;
  const card = viewModel?.cards.find((item) => item.metric === metric);
  const { selectedPoint, scrubbing, resetSelection, onSelectionChange, onScrubChange } = useChartInspection(`${metric}-${range}-${compareMetric ?? 'single'}`, card?.points);
  // A repeated press on the active tab does not trigger a focus change. Its
  // route-scoped event still leaves chart inspection without changing navigation.
  useEffect(() => navigation.addListener('tabPress', resetSelection), [navigation, resetSelection]);
  useFocusEffect(useCallback(() => {
    const activeRequest = request;
    resetSelection();
    if (workspaceReady) void load(range);
    return () => { activeRequest.current++; resetSelection(); };
  }, [load, range, resetSelection, workspaceReady]));
  const second = viewModel?.cards.find((item) => item.metric === compareMetric);
  const metricOptions: MetricPickerOption[] = metricOrder.map((id) => ({ id, label: metricLabel(id), shortLabel: shortMetricLabel(id), icon: trendIcon(id) }));
  const displayedValue = selectedPoint?.value !== undefined ? displayValue(metric, selectedPoint.value) : card?.headline;
  const hasUsableReading = selectedPoint !== null || card?.points.some((point) => point.status === 'available' && point.value !== undefined && Number.isFinite(point.value));
  const changeMetric = (next: TrendMetricId) => { resetSelection(); setMetric(next); rememberWorkspace({ ...workspace.current, metric: next }); if (compareMetric === next) setCompareMetric(null); };
  const changeRange = (next: TrendRangeId) => { resetSelection(); setRange(next); rememberWorkspace({ ...workspace.current, range: next }); };
  const openMetricPicker = (open: boolean) => { resetSelection(); setMetricPickerOpen(open); };
  const openComparePicker = (open: boolean) => { resetSelection(); setComparePickerOpen(open); };
  const changeCompareMetric = (next: TrendMetricId) => { resetSelection(); setCompareMetric(next); };
  const toggleCompare = () => { resetSelection(); if (compareMetric) { setCompareMetric(null); setComparePickerOpen(false); } else { setCompareMetric(metric === 'recovery' ? 'sleep-duration' : 'recovery'); setComparePickerOpen(true); } };

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <StatusBar style={theme.dark ? 'light' : 'dark'} />
    <InspectionBoundary onDismiss={resetSelection} style={styles.inspectionBoundary} testID="trends-inspection-boundary">
    <ScrollView scrollEnabled={!scrubbing} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(range, true)} tintColor={theme.colors.accent} colors={[theme.colors.accent]} />}>
      <View style={styles.pageHeader}><View style={styles.pageHeaderCopy}><Text style={styles.eyebrow}>{tr('trends.eyebrow')}</Text><Text accessibilityRole="header" style={styles.title}>{tr('nav.trends')}</Text></View><View style={styles.headerSymbol}><AppIcon name="trends" color={theme.colors.accent} size={24} /></View></View>
      <View testID="trends-toolbar" style={[styles.controls, (scrubbing || !workspaceReady) && styles.subdued]}>
        <View testID="trends-metric-toolbar" style={styles.metricToolbar}><View style={styles.metricControl}><MetricPicker disabled={!workspaceReady} open={metricPickerOpen} options={metricOptions} value={metric} onChange={changeMetric} onOpenChange={openMetricPicker} theme={theme} /></View><Pressable testID="trends-compare-toggle" disabled={!workspaceReady || !card} accessibilityRole="button" accessibilityState={{ selected: Boolean(compareMetric), disabled: !workspaceReady || !card }} onPress={toggleCompare} style={({ pressed }) => [styles.compareButton, compareMetric && styles.compareActive, pressed && styles.pressed]}><AppIcon name="trends" color={compareMetric ? theme.colors.chartSecondary : theme.colors.textSecondary} size={18} /><Text style={[styles.compareButtonText, compareMetric && styles.compareActiveText]}>{compareMetric ? tr('trends.endCompare') : tr('trends.compare')}</Text></Pressable></View>
        {second ? <MetricPicker comparison open={comparePickerOpen} options={metricOptions.filter((option) => option.id !== metric)} value={second.metric} onChange={changeCompareMetric} onOpenChange={openComparePicker} theme={theme} /> : null}
        <RangeSelector disabled={!workspaceReady} value={range} onChange={changeRange} theme={theme} />
      </View>
      {loading ? <CompactState loading title={report ? tr('trends.updating') : tr('trends.preparing')} theme={theme} /> : null}
      {error ? <CompactState icon="alert" title={report ? tr('trends.saved') : tr('trends.unavailable')} message={error} action={tr('common.retry')} onAction={() => void load(range)} theme={theme} /> : null}
      {!loading && !card ? <CompactState icon="trends" title={tr('trends.noHistory')} message={tr('trends.syncHelp')} theme={theme} /> : null}
      {card ? <Reveal identity={`${metric}-${report?.range}`}>
        <ChartInspectionWorkspace testID="trends-chart-workspace">
        <View testID="trends-reading-header" style={styles.readingHeader}><View style={styles.readingCopy}><Text style={styles.readingCaption}>{selectedPoint ? formatDate(selectedPoint.date) : tr('format.periodValue', { count: report?.days ?? 7, aggregation: report?.series[metric].aggregation === 'median' ? tr('common.median').toLowerCase() : tr('common.average').toLowerCase() })}</Text><View style={styles.readingValueRow}><Text style={[styles.readingValue, !hasUsableReading && styles.missingValue]}>{displayedValue}</Text>{card.unit && hasUsableReading ? <Text style={styles.readingUnit}>{card.unit}</Text> : null}</View></View>
          <Pressable accessibilityRole="button" accessibilityLabel={tr('format.openDetail', { metric: metricLabel(metric) })} onPress={() => router.push({ pathname: '/metric/[metric]', params: { metric: routeMetric(metric), ...(selectedPoint ? { date: selectedPoint.date } : {}) } })} style={({ pressed }) => [styles.detail, pressed && styles.pressed]}><AppIcon name="external" color={theme.colors.accent} size={20} /><Text style={styles.detailText}>{tr('common.details')}</Text></Pressable></View>
        <View style={[styles.chartLegend, scrubbing && styles.subdued]}><View style={styles.legendItem}><View style={[styles.legendLine, { backgroundColor: theme.colors.accent }]} /><Text style={styles.legendText}>{shortMetricLabel(metric)} · {chartUnit(metric)}{second ? ` · ${tr('chart.leftAxis')}` : ''}</Text></View>{second ? <View style={styles.legendItem}><View style={styles.legendDash}><View style={[styles.legendDashPart, { backgroundColor: theme.colors.chartSecondary }]} /><View style={[styles.legendDashPart, { backgroundColor: theme.colors.chartSecondary }]} /></View><Text style={[styles.legendText, { color: theme.colors.chartSecondary }]}>{shortMetricLabel(second.metric)} · {chartUnit(second.metric)} · {tr('chart.rightAxis')}</Text></View> : null}</View>
        <TrendChart key={`${metric}-${report?.range}`} points={card.points} selectedDate={selectedPoint?.date ?? null} theme={theme} height={presentation.chartHeight} unit={chartUnit(metric)} accessibilityLabel={`${tr('format.historyA11y', { metric: metricLabel(metric) })}. ${card.coverage}. ${card.comparison}.`} onSelectionChange={onSelectionChange} onScrubChange={onScrubChange} comparison={second ? { points: second.points, label: shortMetricLabel(second.metric), accessibilityLabel: metricLabel(second.metric), unit: chartUnit(second.metric) } : undefined} />
        </ChartInspectionWorkspace>
        <View style={[styles.belowChart, scrubbing && styles.subdued]}>
          {card.points.some((point) => point.lowerBound !== undefined && point.upperBound !== undefined) ? <Text style={styles.rangeNote}>{tr('trends.shaded')}</Text> : null}
          <View style={styles.periodDates}><Text style={styles.rangeNote}>{formatDate(report?.startDate)} – {formatDate(report?.endDate)}</Text></View>
          {second ? <Text style={styles.compareNote}>{tr('trends.compareNote')}</Text> : null}
          <View style={styles.periodSummary}><SectionLabel title={tr('trends.glance')} theme={theme} /><CoverageRail available={report?.series[metric].availableDays ?? 0} expected={report?.series[metric].expectedDays ?? 0} styles={styles} /><View testID="trends-period-facts" style={styles.facts}><SummaryFact label={tr('common.latest')} value={card.latest} detail={[metric === 'steps' ? chartUnit(metric) : card.unit, formatDate(card.latestDate)].filter(Boolean).join(' · ')} styles={styles} />{card.baseline !== tr('common.notAvailable') ? <SummaryFact label={tr('common.personalRange')} value={card.baseline} detail={(metric === 'steps' ? chartUnit(metric) : card.unit) || undefined} styles={styles} /> : null}</View></View>
          <View style={styles.observation}><AppIcon name="trends" color={theme.colors.accent} size={22} /><View style={styles.observationCopy}><Text style={styles.observationLabel}>{tr('format.previous', { count: report?.days ?? 7 })}</Text><Text style={styles.observationText}>{card.comparison}</Text></View></View>
          {metric === 'sleep-duration' && viewModel ? <View style={styles.observation}><AppIcon name="sleep" color={theme.colors.sleep} size={22} /><View style={styles.observationCopy}><Text style={styles.observationLabel}>{tr('trends.sleepTiming')}</Text><Text style={styles.observationText}>{viewModel.consistency}</Text></View></View> : null}
        </View>
      </Reveal> : null}
    </ScrollView>
    </InspectionBoundary>
  </SafeAreaView>;
}
function trendIcon(metric: TrendMetricId): AppIconName { return metric === 'recovery' ? 'recovery' : metric === 'sleep-duration' ? 'sleep' : metric === 'hrv-rmssd' ? 'hrv' : metric === 'resting-heart-rate' ? 'heart' : 'activity'; }
function shortMetricLabel(metric: TrendMetricId) { return metric === 'sleep-duration' ? tr('metric.sleep') : metric === 'hrv-rmssd' ? tr('metric.hrv') : metric === 'resting-heart-rate' ? tr('metric.rhr') : metric === 'steps' ? tr('metric.steps') : tr('metric.recovery'); }
function metricLabel(metric: TrendMetricId) { return metric === 'sleep-duration' ? tr('metric.sleepDuration') : metric === 'hrv-rmssd' ? `${tr('metric.hrv')} · ${tr('metric.hrvFull')}` : metric === 'resting-heart-rate' ? `${tr('metric.rhr')} · ${tr('metric.rhrFull')}` : metric === 'steps' ? tr('metric.steps') : tr('metric.recovery'); }
function routeMetric(metric: TrendMetricId) { return metric === 'sleep-duration' ? 'sleep' : metric === 'hrv-rmssd' ? 'hrv' : metric === 'resting-heart-rate' ? 'rhr' : metric === 'steps' ? 'activity' : 'recovery'; }
function chartUnit(metric: TrendMetricId) { return metric === 'recovery' ? 'pts' : metric === 'sleep-duration' ? 'min' : metric === 'hrv-rmssd' ? 'ms' : metric === 'resting-heart-rate' ? 'bpm' : tr('metric.stepsLower'); }
function displayValue(metric: TrendMetricId, value: number) { return metric === 'sleep-duration' ? formatSleepDuration(Math.round(value)) : formatNumber(Math.round(value * 10) / 10); }
function formatDate(date?: string) { return date ? new Intl.DateTimeFormat(getLocale(), { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) : ''; }
function SummaryFact({ label, value, detail, styles }: { label: string; value: string; detail?: string; styles: ReturnType<typeof createStyles> }) { return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text>{detail ? <Text style={styles.factDetail}>{detail}</Text> : null}</View>; }
function CoverageRail({ available, expected, styles }: { available: number; expected: number; styles: ReturnType<typeof createStyles> }) { return <View style={styles.coverage} accessible accessibilityRole="progressbar" accessibilityLabel={tr('common.recordedDays')} accessibilityValue={{ min: 0, max: expected, now: available, text: tr('format.coverage', { available, expected }) }}><View style={styles.coverageHeader}><Text style={styles.factLabel}>{tr('common.recordedDays')}</Text><Text style={styles.coverageValue}>{available} / {expected}</Text></View><View style={styles.coverageTrack}><View style={[styles.coverageFill, { width: `${expected ? available / expected * 100 : 0}%` }]} /></View></View>; }
function createStyles(theme: AppTheme, compact: boolean, presentation: ReturnType<typeof getTrendsPresentationLayout>) { const { stackToolbar, stackReading, stackStats } = presentation; return StyleSheet.create({
  safeArea: { backgroundColor: theme.colors.background, flex: 1 }, inspectionBoundary: { flex: 1 }, content: { alignSelf: 'center', maxWidth: theme.layout.contentMaxWidth, paddingBottom: 36, paddingHorizontal: compact ? 16 : 24, paddingTop: 22, width: '100%' },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between' }, pageHeaderCopy: { flex: 1, minWidth: 0 }, headerSymbol: { height: 46, width: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: theme.colors.accentSoft },
  eyebrow: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 1.3 }, title: { color: theme.colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -0.8, marginTop: 4 }, controls: { gap: 10, marginTop: 22 },
  metricToolbar: { flexDirection: stackToolbar ? 'column' : 'row', alignItems: 'stretch', gap: 8 }, metricControl: { flex: stackToolbar ? undefined : 1, minWidth: 0 },
  compareButton: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 7, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 17, backgroundColor: theme.colors.surface, maxWidth: '100%' }, compareActive: { backgroundColor: theme.colors.surfaceMuted }, compareButtonText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', flexShrink: 1 }, compareActiveText: { color: theme.colors.chartSecondary },
  readingHeader: { alignItems: stackReading ? 'flex-start' : 'center', flexDirection: stackReading ? 'column' : 'row', gap: 12, justifyContent: 'space-between', marginTop: 28 }, readingCopy: { flex: stackReading ? undefined : 1, width: stackReading ? '100%' : undefined, minWidth: 0 }, readingCaption: { color: theme.colors.textSecondary, fontSize: 12 }, readingValueRow: { direction: 'ltr', alignItems: stackReading ? 'flex-start' : 'baseline', flexDirection: stackReading ? 'column' : 'row', flexWrap: 'wrap', columnGap: 8, marginTop: 5 }, readingValue: { maxWidth: '100%', flexShrink: 1, color: theme.colors.text, fontSize: compact ? 48 : 54, fontWeight: '700', letterSpacing: -1.8, fontVariant: ['tabular-nums'] }, readingUnit: { color: theme.colors.textSecondary, fontSize: 12, marginTop: stackReading ? 4 : 0 },
  missingValue: { color: theme.colors.textSecondary, fontSize: 20, letterSpacing: 0, lineHeight: 28, marginTop: 5 },
  detail: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, minHeight: 48, minWidth: 48, paddingHorizontal: 11, borderRadius: 14, backgroundColor: theme.colors.surface }, detailText: { color: theme.colors.accent, fontSize: 11, fontWeight: '600' },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18, marginBottom: 2 }, legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6, maxWidth: '100%' }, legendLine: { borderRadius: 2, height: 3, width: 15 }, legendDash: { flexDirection: 'row', gap: 3 }, legendDashPart: { height: 2, width: 6, borderRadius: 2 }, legendText: { color: theme.colors.textSecondary, flexShrink: 1, fontSize: 11 },
  belowChart: { marginTop: 8 }, rangeNote: { color: theme.colors.textMuted, fontSize: 11, flexShrink: 1 }, periodDates: { marginTop: 6 }, compareNote: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 10 },
  periodSummary: { marginTop: 22, paddingTop: 18, borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  coverage: { marginBottom: 20 }, coverageHeader: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 9 }, coverageValue: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'], writingDirection: 'ltr' }, coverageTrack: { direction: 'ltr', backgroundColor: theme.colors.surfaceMuted, borderRadius: 3, height: 3, overflow: 'hidden' }, coverageFill: { backgroundColor: theme.colors.accentMuted, height: '100%', borderRadius: 3 },
  facts: { flexDirection: stackStats ? 'column' : 'row', flexWrap: 'wrap', gap: 18 }, fact: { flexBasis: stackStats ? undefined : '44%', flexGrow: 1, minWidth: 0 }, factLabel: { color: theme.colors.textMuted, fontSize: 11 }, factValue: { color: theme.colors.text, fontSize: 22, fontWeight: '600', marginTop: 6, fontVariant: ['tabular-nums'] }, factDetail: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 5 },
  observation: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, marginTop: 22 }, observationCopy: { flex: 1, minWidth: 0 }, observationLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }, observationText: { color: theme.colors.text, fontSize: 14, lineHeight: 21, marginTop: 5 }, subdued: { opacity: 0.55 }, pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
}); }
