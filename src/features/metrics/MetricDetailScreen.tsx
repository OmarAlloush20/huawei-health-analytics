import { getLocale, tr } from '../../localization/i18n';
import { Text, View, Pressable } from '../../localization/LocalizedNative';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appDependencies } from '../../appDependencies';
import { AppIcon } from '../../components/AppIcon';
import { CompactState } from '../../components/ProductUI';
import { RecoveryGauge } from '../../components/SignalVisuals';
import type { LocalDate } from '../../models/health';
import type { TrendPoint, TrendRangeId, TrendReport } from '../../models/trends';
import type { DashboardDayData } from '../../services/DashboardDataService';
import { addLocalDays, getSystemTimeZone } from '../../shared/dates/healthDates';
import { useAppTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/theme';
import { getResponsiveLayout } from '../../theme/responsive';
import { RangeSelector } from '../trends/RangeSelector';
import { TrendChart } from '../trends/TrendChart';
import { ChartInspectionWorkspace, InspectionBoundary, useChartInspection } from '../trends/chartInspection';
import { buildTrendsViewModel } from '../trends/trendViewModel';
import { buildRawMetricPoints, summarizeMetricPoints, type MetricRoute } from './metricDetailModel';
import { detailMeta, formatDetailValue, getSelectedDayPresentation, trendMetricForDetail } from './metricDetailPresentation';
import { MetricDayContext } from './MetricDayContext';

const validMetrics: readonly MetricRoute[] = ['recovery', 'sleep', 'hrv', 'rhr', 'spo2', 'stress', 'activity'];
const rangeDays: Record<TrendRangeId, number> = { '7d': 7, '30d': 30, '90d': 90 };
interface HistoryData { anchor: LocalDate; timeZone: string; generation: number; points: TrendPoint[]; report: TrendReport; periodValue?: number; comparison?: string; aggregation: 'average' | 'median' }

export function MetricDetailScreen() {
  const params = useLocalSearchParams<{ metric: string; date?: string }>();
  const metric = validMetrics.includes(params.metric as MetricRoute) ? params.metric as MetricRoute : 'recovery';
  const { theme } = useAppTheme();
  const { width, fontScale } = useWindowDimensions();
  const { compact, singleColumn, stackRecovery } = getResponsiveLayout(width, fontScale);
  const styles = useMemo(() => createStyles(theme, compact, singleColumn, stackRecovery), [compact, singleColumn, stackRecovery, theme]);
  const [range, setRange] = useState<TrendRangeId>('30d');
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [selectedDay, setSelectedDay] = useState<{ date: LocalDate; data: DashboardDayData } | null>(null);
  const [error, setError] = useState('');
  const [dayFailure, setDayFailure] = useState<{ date: LocalDate; message: string } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const dayCache = useRef(new Map<string, DashboardDayData>());
  const pendingDays = useRef(new Map<string, Promise<DashboardDayData>>());
  const historyGeneration = useRef(0);
  const inspection = useChartInspection(`${metric}:${range}:${params.date ?? ''}`, history?.points);
  const { resetSelection, scrubbing } = inspection;
  // The narrative defaults to the requested/latest day; an inspection is never restored.
  const selectedDate = history ? inspection.selectedPoint?.date ?? history.anchor : null;
  const meta = detailMeta(metric);
  const returnToAnchor = useCallback(() => {
    if (history && selectedDay?.date !== history.anchor) {
      const cached = dayCache.current.get(`${history.generation}:${history.timeZone}:${history.anchor}`);
      if (cached && (!cached.summary || cached.summary.date === history.anchor)) setSelectedDay({ date: history.anchor, data: cached });
    }
    resetSelection();
  }, [history, resetSelection, selectedDay?.date]);

  useFocusEffect(useCallback(() => {
    let active = true;
    resetSelection();
    const generation = ++historyGeneration.current;
    void appDependencies.getPersistence().then(async ({ dashboardService, repository, trendsService }) => {
      if (!active) return;
      setLoadingHistory(true);
      setError('');
      let stats = await dashboardService.getStats();
      stats = await dashboardService.bootstrapDevelopmentDataIfEmpty(stats);
      if (!stats.lastDate || stats.storedDays === 0) {
        if (!active) return;
        dayCache.current.clear();
        pendingDays.current.clear();
        setHistory(null);
        setSelectedDay(null);
        resetSelection();
        setDayFailure(null);
        setError(tr('error.syncEmpty'));
        return;
      }
      const anchor = (params.date && params.date >= (stats.firstDate ?? params.date) && params.date <= (stats.lastDate ?? params.date) ? params.date : stats.lastDate) as LocalDate | undefined;
      if (!anchor) throw new Error(tr('error.syncEmpty'));
      const timeZone = stats.sync?.range?.timeZone ?? getSystemTimeZone();
      const days = rangeDays[range];
      const [report, summaries] = await Promise.all([
        trendsService.getReport(range, anchor, timeZone),
        repository.getDailySummaries(stats.provider, { start: addLocalDays(anchor, -(days - 1)), end: anchor, timeZone }),
      ]);
      const mapped = trendMetricForDetail(metric);
      const points = mapped ? report.series[mapped].points : buildRawMetricPoints(metric as 'spo2' | 'stress', summaries, anchor, days, timeZone);
      const periodValue = mapped ? report.series[mapped].comparison.currentValue : summarizeMetricPoints(points).average;
      const comparison = mapped ? buildTrendsViewModel(report).cards.find((item) => item.metric === mapped)?.comparison : undefined;
      if (!active) return;
      dayCache.current.clear();
      setHistory({ anchor, timeZone, generation, points, report, periodValue, comparison, aggregation: mapped ? report.series[mapped].aggregation : 'average' });
    }).catch(() => {
      if (active) setError(tr('error.history'));
    }).finally(() => { if (active) setLoadingHistory(false); });
    return () => { active = false; resetSelection(); };
  }, [metric, params.date, range, resetSelection]));

  useEffect(() => {
    if (!history || !selectedDate) return;
    let active = true;
    const generation = history.generation;
    const key = `${generation}:${history.timeZone}:${selectedDate}`;
    void appDependencies.getPersistence().then(async ({ dashboardService }) => {
      if (!active || generation !== historyGeneration.current) return null;
      const cached = dayCache.current.get(key);
      setDayFailure(null);
      setSelectedDay(cached ? { date: selectedDate, data: cached } : null);
      if (cached) return cached;
      const pending = pendingDays.current.get(key);
      if (pending) return pending;
      const request = dashboardService.readDay(selectedDate, history.timeZone).finally(() => { pendingDays.current.delete(key); });
      pendingDays.current.set(key, request);
      return request;
    }).then((day) => {
      if (!day || generation !== historyGeneration.current) return;
      dayCache.current.set(key, day);
      if (active) setSelectedDay({ date: selectedDate, data: day });
    }).catch((reason: unknown) => {
      if (active && generation === historyGeneration.current) setDayFailure({ date: selectedDate, message: tr('error.dayContext') });
    });
    return () => { active = false; };
  }, [history, selectedDate]);

  const point = history?.points.find((item) => item.date === selectedDate);
  // Never pair the next scrub value with the preceding day's explanation.
  const day = selectedDay?.date === selectedDate ? selectedDay.data : null;
  const presentation = day ? getSelectedDayPresentation(metric, day) : null;
  const dayError = dayFailure?.date === selectedDate ? dayFailure.message : '';
  const context = presentation?.context ?? (day ? tr('common.noDayReading') : dayError || tr('detail.dayContextLoading'));
  const recoveryState = day && !day.summary ? tr('detail.noScore') : day?.recovery?.category ? tr(`recovery.${day.recovery.category}`) : presentation?.view.recovery.title ?? (point?.value === undefined ? tr('detail.building') : tr('metric.recovery'));
  const period = history ? summarizeMetricPoints(history.points) : null;
  return <InspectionBoundary onDismiss={returnToAnchor} testID="detail-inspection-boundary" style={styles.safeArea}><SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
    <StatusBar style={theme.dark ? 'light' : 'dark'} />
    <ScrollView contentContainerStyle={styles.content} scrollEnabled={!scrubbing} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}><Pressable accessibilityLabel={tr('common.back')} accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><AppIcon color={theme.colors.text} name="arrow-left" size={22} /></Pressable><View style={styles.titleCopy}><Text accessibilityLabel={meta.accessibilityLabel} accessibilityRole="header" style={styles.topTitle}>{meta.label}</Text>{meta.label !== meta.accessibilityLabel ? <Text style={styles.metadata}>{meta.accessibilityLabel}</Text> : null}</View><View style={styles.metricIcon}><AppIcon color={metric === 'sleep' ? theme.colors.sleep : metric === 'activity' ? theme.colors.activity : theme.colors.accent} name={meta.icon} size={24} /></View></View>
      {error ? <CompactState icon="alert" title={tr('trends.unavailable')} message={error} theme={theme} /> : null}
      {!history && loadingHistory ? <CompactState loading title={tr('detail.opening')} message={meta.label} theme={theme} /> : null}
      {history && period ? <>
        <View style={styles.selectedHeader}><Text style={styles.selectedDate}>{formatDate(selectedDate ?? history.anchor)}</Text>{selectedDate !== history.anchor ? <Pressable accessibilityRole="button" accessibilityLabel={tr('detail.returnLatest')} onPress={returnToAnchor} style={({ pressed }) => [styles.latestButton, pressed && styles.pressed]}><Text style={styles.link}>{tr('common.latestDay')}</Text></Pressable> : <Text style={styles.metadata}>{tr('common.latestDay')}</Text>}</View>
        {metric === 'recovery' ? <View testID="detail-recovery-hero" style={styles.recoveryHero}><RecoveryGauge score={point?.value ?? day?.recovery?.score} size={singleColumn ? 164 : compact ? 154 : 172} theme={theme} /><View style={styles.heroCopy}><Text style={styles.recoveryState}>{recoveryState}</Text><Text style={styles.context}>{context}</Text>{day?.recovery ? <View style={styles.confidence}><Text style={styles.confidenceText}>{tr('format.recoveryInputs', { count: day.recovery.completenessPercent, signals: day.recovery.usableSignalCount })}</Text></View> : null}</View></View> : <View testID={`detail-value-hero-${metric}`} style={styles.valueHero}><View style={styles.valueLine}><Text style={[styles.heroValue, point?.value === undefined && { fontSize: 23, letterSpacing: 0 }]}>{point?.value !== undefined ? formatDetailValue(metric, point.value, false) : presentation?.display.value ?? tr('common.noReading')}</Text>{point?.value !== undefined && meta.heroUnit ? <Text style={[styles.heroUnit, { color: metric === 'sleep' ? theme.colors.sleep : metric === 'activity' ? theme.colors.activity : theme.colors.textSecondary }]}>{meta.heroUnit}</Text> : null}</View><Text style={styles.context}>{context}</Text></View>}
        <View testID="detail-day-context" style={[styles.daySection, scrubbing && styles.secondaryFaded]}><View style={styles.sectionTop}><Text accessibilityRole="header" style={styles.sectionTitle}>{meta.detailTitle}</Text></View>{day ? <MetricDayContext key={metric} day={day} history={history} metric={metric} singleColumn={singleColumn} theme={theme} /> : <CompactState icon={dayError ? 'alert' : meta.icon} loading={!dayError} title={dayError ? tr('detail.dayUnavailable') : tr('detail.readingDay')} message={dayError || undefined} theme={theme} />}</View>
        <View testID="detail-history" style={[styles.historySection, loadingHistory && styles.loading]}>
          <View style={styles.sectionTop}><Text accessibilityRole="header" style={styles.sectionTitle}>{tr('common.history')}</Text>{loadingHistory ? <Text style={styles.metadata}>{tr('common.updating')}</Text> : null}</View>
          <RangeSelector onChange={(next) => { resetSelection(); setRange(next); }} theme={theme} value={range} />
          <ChartInspectionWorkspace testID="detail-chart-workspace">{history.points.some((item) => item.status === 'available') ? <TrendChart accessibilityLabel={tr('format.historyA11y', { metric: meta.accessibilityLabel })} height={276} onScrubChange={inspection.onScrubChange} onSelectionChange={inspection.onSelectionChange} points={history.points} selectedDate={inspection.selectedPoint?.date ?? null} theme={theme} unit={meta.chartUnit} /> : <CompactState icon={meta.icon} title={tr('chart.noReadings')} message={tr('detail.tryLonger')} theme={theme} />}</ChartInspectionWorkspace>
          <View style={[styles.periodFacts, scrubbing && styles.secondaryFaded]}><Fact label={tr('format.periodAggregation', { aggregation: history.aggregation === 'median' ? tr('common.median').toLowerCase() : tr('common.average').toLowerCase() })} value={formatDetailValue(metric, history.periodValue)} styles={styles} /><Fact label={tr('common.coverage')} value={tr('format.coverageShort', { available: period.availableDays, expected: period.expectedDays })} styles={styles} /></View>
          {history.comparison ? <Text style={[styles.periodContext, scrubbing && styles.secondaryFaded]}>{history.comparison}</Text> : null}
        </View>
        {metric === 'spo2' || metric === 'stress' ? <View style={styles.recentSection}><Text accessibilityRole="header" style={styles.sectionTitle}>{tr('detail.recent')}</Text>{history.points.filter((item) => item.status === 'available').slice(-5).reverse().map((item) => <Pressable accessibilityLabel={`${formatDate(item.date)}, ${formatDetailValue(metric, item.value)}`} accessibilityRole="button" accessibilityState={{ selected: item.date === selectedDate }} key={item.date} onPress={() => inspection.onSelectionChange(item)} style={({ pressed }) => [styles.readingRow, item.date === selectedDate && styles.readingSelected, pressed && styles.pressed]}><Text style={styles.readingDate}>{formatDate(item.date, false)}</Text><Text style={styles.readingValue}>{formatDetailValue(metric, item.value)}</Text><Text style={styles.readingArrow}>{item.date === selectedDate ? '●' : '›'}</Text></Pressable>)}</View> : null}
        <View style={styles.guide}><Pressable accessibilityRole="button" accessibilityState={{ expanded: guideOpen }} onPress={() => setGuideOpen((previous) => !previous)} style={({ pressed }) => [styles.guideButton, pressed && styles.pressed]}><Text style={styles.guideTitle}>{tr('format.understand', { metric: meta.shortLabel })}</Text><Text style={styles.guideArrow}>{guideOpen ? '−' : '+'}</Text></Pressable>{guideOpen ? <Text style={styles.guideCopy}>{meta.guide}</Text> : null}</View>
      </> : null}
    </ScrollView>
  </SafeAreaView></InspectionBoundary>;
}

type DetailStyles = ReturnType<typeof createStyles>;
function Fact({ label, value, styles }: { label: string; value: string; styles: DetailStyles }) { return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>; }
function formatDate(date?: string, full = true) { return date ? new Intl.DateTimeFormat(getLocale(), { timeZone: 'UTC', month: 'short', day: 'numeric', ...(full ? { weekday: 'short' as const, year: 'numeric' as const } : {}) }).format(new Date(`${date}T12:00:00Z`)) : ''; }

function createStyles(theme: AppTheme, compact: boolean, singleColumn: boolean, stackRecovery: boolean) { return StyleSheet.create({
  safeArea: { backgroundColor: theme.colors.background, flex: 1 },
  content: { alignSelf: 'center', maxWidth: theme.layout.contentMaxWidth, paddingBottom: 40, paddingHorizontal: compact ? 20 : 24, width: '100%' },
  topBar: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingTop: 8, paddingBottom: 4 },
  back: { alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 16, justifyContent: 'center', minHeight: 48, width: 48 },
  titleCopy: { flex: 1, minWidth: 0 }, topTitle: { color: theme.colors.text, fontSize: compact ? 23 : 26, fontWeight: '600', letterSpacing: -0.5 },
  metricIcon: { alignItems: 'center', backgroundColor: theme.colors.accentSoft, borderRadius: 14, justifyContent: 'center', width: 40, height: 40 }, pressed: { opacity: 0.6 },
  selectedHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginTop: 8, minHeight: 48 },
  selectedDate: { color: theme.colors.textSecondary, flexShrink: 1, fontSize: 12, fontWeight: '500', paddingVertical: 8 },
  latestButton: { justifyContent: 'center', minHeight: 48, paddingHorizontal: 8 }, link: { color: theme.colors.accent, fontSize: 12, fontWeight: '600' },
  recoveryHero: { backgroundColor: theme.colors.surface, borderRadius: 26, alignItems: 'center', flexDirection: stackRecovery ? 'column' : 'row', gap: 16, padding: 20 },
  heroCopy: { flex: stackRecovery ? undefined : 1, alignSelf: stackRecovery ? 'stretch' : undefined, minWidth: 0 },
  recoveryState: { color: theme.colors.text, fontSize: 23, fontWeight: '600', letterSpacing: -0.5 },
  context: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 8 },
  confidence: { borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 16, paddingTop: 12 },
  confidenceText: { color: theme.colors.textSecondary, fontSize: 11, lineHeight: 18, fontWeight: '500' },
  valueHero: { paddingTop: 6, paddingBottom: 6 },
  valueLine: { direction: 'ltr', alignItems: singleColumn ? 'flex-start' : 'baseline', flexDirection: singleColumn ? 'column' : 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 4 },
  heroValue: { direction: 'ltr', writingDirection: 'ltr', textAlign: 'left', color: theme.colors.text, flexShrink: 1, maxWidth: '100%', fontSize: compact ? 44 : 56, fontWeight: '600', letterSpacing: -1.4, fontVariant: ['tabular-nums'] },
  heroUnit: { color: theme.colors.textSecondary, fontSize: 17, fontWeight: '500' },
  daySection: { marginTop: 22, marginBottom: 28 },
  historySection: { borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 24 },
  sectionTop: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  metadata: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 17 },
  periodFacts: { backgroundColor: theme.colors.surfaceRaised, borderRadius: 16, flexDirection: singleColumn ? 'column' : 'row', flexWrap: 'wrap', marginTop: 16, padding: 16, gap: 16 },
  fact: { flexGrow: 1, flexBasis: singleColumn ? '100%' : '42%', minWidth: 100 },
  factLabel: { color: theme.colors.textSecondary, fontSize: 11, lineHeight: 17 },
  factValue: { color: theme.colors.text, fontSize: 22, fontWeight: '600', marginTop: 4, fontVariant: ['tabular-nums'] },
  periodContext: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 12 },
  secondaryFaded: { opacity: 0.5 }, loading: { opacity: 0.65 },
  recentSection: { marginTop: 28 },
  readingRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10, minHeight: 60, paddingHorizontal: 12, paddingVertical: 12 },
  readingSelected: { backgroundColor: theme.colors.accentSoft, borderRadius: 14 },
  readingDate: { color: theme.colors.textSecondary, flexGrow: 1, fontSize: 13 },
  readingValue: { color: theme.colors.text, fontSize: 19, fontWeight: '600', fontVariant: ['tabular-nums'] },
  readingArrow: { color: theme.colors.accent, fontSize: 18 },
  guide: { borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 26, paddingTop: 6 },
  guideButton: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 54 },
  guideTitle: { color: theme.colors.textSecondary, flex: 1, fontSize: 13, fontWeight: '500' },
  guideArrow: { color: theme.colors.accent, fontSize: 22 }, guideCopy: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 21, paddingBottom: 14 },
}); }
