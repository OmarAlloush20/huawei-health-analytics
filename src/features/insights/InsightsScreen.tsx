import { getLocale, tr } from '../../localization/i18n';
import { Text, View, Pressable } from '../../localization/LocalizedNative';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appDependencies } from '../../appDependencies';
import { AppIcon, type AppIconName } from '../../components/AppIcon';
import { CompactState, ProductSheet, Reveal, SectionLabel } from '../../components/ProductUI';
import { Sparkline } from '../../components/SignalVisuals';
import type { DeterministicInsight, InsightsResult } from '../../models/insights';
import type { TrendMetricId, TrendRangeId, TrendReport } from '../../models/trends';
import { getSystemTimeZone } from '../../shared/dates/healthDates';
import { formatNumber, formatSleepDuration } from '../../shared/formatters/healthFormatters';
import { getResponsiveLayout } from '../../theme/responsive';
import type { AppTheme } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';
import { RangeSelector } from '../trends/RangeSelector';
import { buildTrendsViewModel } from '../trends/trendViewModel';

function getMetricMeta(): Record<TrendMetricId, { label: string; fullLabel: string; route: string; icon: AppIconName; unit: string }> { return {
  recovery: { label: tr('metric.recovery'), fullLabel: tr('metric.recovery'), route: 'recovery', icon: 'recovery', unit: '/100' },
  'sleep-duration': { label: tr('metric.sleep'), fullLabel: tr('metric.sleepDuration'), route: 'sleep', icon: 'sleep', unit: '' },
  'hrv-rmssd': { label: tr('metric.hrv'), fullLabel: tr('metric.hrvFull'), route: 'hrv', icon: 'hrv', unit: 'ms' },
  'resting-heart-rate': { label: tr('metric.rhrShort'), fullLabel: tr('metric.rhrFull'), route: 'rhr', icon: 'heart', unit: 'bpm' },
  steps: { label: tr('metric.steps'), fullLabel: tr('metric.steps'), route: 'activity', icon: 'activity', unit: 'steps' },
}; }

interface InsightData { result: InsightsResult; report: TrendReport; weeklyResult: InsightsResult; weeklyReport: TrendReport }

export function InsightsScreen() {
  const { theme } = useAppTheme();
  const { width, fontScale } = useWindowDimensions();
  const { compact, enlargedText } = getResponsiveLayout(width, fontScale);
  const styles = useMemo(() => createStyles(theme, compact), [compact, theme]);
  const [range, setRange] = useState<TrendRangeId>('7d');
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showWeekly, setShowWeekly] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (nextRange: TrendRangeId, refresh = false) => {
    const request = ++requestId.current;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { dashboardService, insightsService, trendsService } = await appDependencies.getPersistence();
      let stats = await dashboardService.getStats();
      stats = await dashboardService.bootstrapDevelopmentDataIfEmpty(stats);
      if (!stats.lastDate) { if (request === requestId.current) setData(null); return; }
      const timeZone = stats.sync?.range?.timeZone ?? getSystemTimeZone();
      const [result, report, weeklyResult, weeklyReport] = await Promise.all([
        insightsService.getInsights(nextRange, stats.lastDate, timeZone),
        trendsService.getReport(nextRange, stats.lastDate, timeZone),
        nextRange === '7d' ? Promise.resolve(null) : insightsService.getInsights('7d', stats.lastDate, timeZone),
        nextRange === '7d' ? Promise.resolve(null) : trendsService.getReport('7d', stats.lastDate, timeZone),
      ]);
      if (request === requestId.current) setData({ result, report, weeklyResult: weeklyResult ?? result, weeklyReport: weeklyReport ?? report });
    } catch {
      if (request === requestId.current) setError(tr('error.insights'));
    } finally {
      if (request === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void Promise.resolve().then(() => load(range));
    return () => { requestId.current += 1; };
  }, [load, range]));

  const visibleData = data?.report.range === range ? data : null;
  // The tab bar owns the bottom system inset; this screen owns the other edges.
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <StatusBar style={theme.dark ? 'light' : 'dark'} />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(range, true)} tintColor={theme.colors.accent} colors={[theme.colors.accent]} />}>
      <View style={styles.pageHeading}><View style={styles.pageCopy}><Text style={styles.eyebrow}>{tr('insights.notice')}</Text><Text accessibilityRole="header" style={styles.title}>{tr('nav.insights')}</Text></View><View style={styles.headerSymbol}><AppIcon name="insights" color={theme.colors.accent} size={24} /></View></View>
      <View style={styles.selector}><RangeSelector value={range} onChange={setRange} theme={theme} /></View>
      {loading ? <CompactState loading title={tr('insights.preparing')} message={tr('insights.checking')} theme={theme} /> : null}
      {error ? <CompactState icon="alert" title={visibleData ? tr('insights.refreshFailed') : tr('insights.unavailable')} message={error} action={tr('common.retry')} onAction={() => void load(range, true)} theme={theme} /> : null}
      {!loading && !error && !visibleData ? <CompactState icon="insights" title={tr('trends.noHistory')} message={tr('insights.syncHelp')} theme={theme} /> : null}
      {visibleData ? <Reveal identity={range}>
        <View style={styles.snapshotSection}>
          <View style={styles.snapshotHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>{tr('format.snapshot', { count: visibleData.report.days })}</Text><Text style={styles.dates}>{dateRange(visibleData.report)}</Text></View>
          <Snapshot report={visibleData.report} theme={theme} enlargedText={enlargedText} />
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={tr('insights.openWeekly')} onPress={() => setShowWeekly(true)} style={({ pressed }) => [styles.digestLink, pressed && styles.pressed]}>
          <View style={styles.digestIcon}><AppIcon name="trends" color={theme.colors.accent} size={21} /></View><View style={styles.digestCopy}><Text style={styles.digestTitle}>{tr('insights.yourWeekly')}</Text><Text style={styles.digestDate}>{tr('format.weekPeriod', { dates: dateRange(visibleData.weeklyReport) })}</Text></View><Text style={styles.chevron}>›</Text>
        </Pressable>

        <View style={styles.feed}>
          <SectionLabel title={tr('insights.observations')} theme={theme} />
          {visibleData.result.insights.length ? visibleData.result.insights.map((insight, index) => <Observation key={insight.ruleId} insight={insight} report={visibleData.report} theme={theme} enlargedText={enlargedText} compact={compact} leading={index === 0} />) : <CompactState icon="insights" title={tr('insights.noChange')} message={tr('insights.noPattern')} theme={theme} />}
        </View>
      </Reveal> : null}
    </ScrollView>
    <ProductSheet visible={showWeekly} title={tr('insights.week')} subtitle={data ? tr('format.weekSeven', { dates: dateRange(data.weeklyReport) }) : undefined} onClose={() => setShowWeekly(false)} theme={theme}>
      {data ? <>
        <Snapshot report={data.weeklyReport} theme={theme} enlargedText={enlargedText} weekly onNavigate={() => setShowWeekly(false)} />
        <View style={styles.weeklyPattern}><SectionLabel title={tr('insights.weekPattern')} theme={theme} />{data.weeklyResult.insights[0] ? <Observation insight={data.weeklyResult.insights[0]} report={data.weeklyReport} theme={theme} enlargedText={enlargedText} compact={compact} leading onNavigate={() => setShowWeekly(false)} /> : <CompactState icon="insights" title={tr('insights.noChange')} message={tr('insights.noWeekChange')} theme={theme} />}</View>
      </> : null}
    </ProductSheet>
  </SafeAreaView>;
}

function Snapshot({ report, theme, enlargedText, weekly = false, onNavigate }: { report: TrendReport; theme: AppTheme; enlargedText: boolean; weekly?: boolean; onNavigate?: () => void }) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const items = buildTrendsViewModel(report).cards;
  const featured = items.filter((item) => item.metric === 'recovery' || item.metric === 'sleep-duration');
  const signals = items.filter((item) => item.metric !== 'recovery' && item.metric !== 'sleep-duration');
  const renderReading = (item: (typeof items)[number], prominent: boolean) => <SnapshotReading key={item.metric} item={item} report={report} theme={theme} styles={styles} enlargedText={enlargedText} weekly={weekly} prominent={prominent} onNavigate={onNavigate} />;
  return <View testID="insights-recap" style={[styles.recap, weekly && styles.weeklyRecap]}>
    <View testID="insights-featured-recap" style={[styles.recapRow, enlargedText && styles.recapStack]}>{featured.map((item) => renderReading(item, true))}</View>
    <View style={styles.recapDivider} />
    <View testID="insights-signal-recap" style={[styles.recapRow, enlargedText && styles.recapStack]}>{signals.map((item) => renderReading(item, false))}</View>
  </View>;
}

function SnapshotReading({ item, report, theme, styles, enlargedText, weekly, prominent, onNavigate }: {
  item: ReturnType<typeof buildTrendsViewModel>['cards'][number]; report: TrendReport; theme: AppTheme; styles: ReturnType<typeof createStyles>; enlargedText: boolean; weekly: boolean; prominent: boolean; onNavigate?: () => void;
}) {
  const meta = getMetricMeta()[item.metric];
  const series = report.series[item.metric];
  const missing = !series.availableDays;
  const aggregation = series.aggregation === 'median' ? tr('common.median') : tr('common.average');
  const context = weekly ? item.comparison : tr('format.aggregationCoverage', { aggregation, available: series.availableDays, expected: series.expectedDays });
  const accessibleValue = missing ? tr('common.noData') : `${item.headline} ${meta.unit}`.trim();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${meta.fullLabel}, ${accessibleValue}. ${context}. View details.`} onPress={() => { onNavigate?.(); openMetric(item.metric, report.endDate); }} style={({ pressed }) => [styles.reading, enlargedText && styles.readingExpanded, pressed && styles.readingPressed]}>
    <View style={styles.readingIdentity}><AppIcon name={meta.icon} color={signalColor(item.metric, theme)} size={16} /><Text style={styles.snapshotLabel}>{weekly && item.metric === 'recovery' ? tr('insights.averageRecovery') : weekly && item.metric === 'sleep-duration' ? tr('insights.averageSleep') : meta.label}</Text></View>
    <View style={styles.valueLine}><Text style={[styles.snapshotValue, prominent && styles.featuredValue, missing && styles.missingValue]}>{missing ? tr('common.noData') : item.headline}</Text>{!missing && meta.unit && item.metric !== 'steps' ? <Text style={styles.unit}>{meta.unit}</Text> : null}</View>
    <Text style={styles.snapshotContext}>{weekly ? context : aggregation}</Text>
    <Text style={styles.snapshotCoverage}>{tr('format.compactCoverage', { available: series.availableDays, expected: series.expectedDays })}</Text>
  </Pressable>;
}

function Observation({ insight, report, theme, enlargedText, compact, leading = false, onNavigate }: { insight: DeterministicInsight; report: TrendReport; theme: AppTheme; enlargedText: boolean; compact: boolean; leading?: boolean; onNavigate?: () => void }) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const metric = insight.metric;
  const meta = metric ? getMetricMeta()[metric] : null;
  const series = metric ? report.series[metric] : null;
  const color = metric ? signalColor(metric, theme) : theme.colors.accent;
  const content = <>
    <View style={styles.observationMeta}><View style={styles.topic}><View style={styles.topicGlyph}><AppIcon name={meta?.icon ?? 'insights'} color={color} size={16} /></View><Text style={[styles.topicText, { color }]}>{insight.type === 'sleep-consistency' ? tr('insights.timing') : meta?.label ?? tr('today.data')}</Text></View><Text style={styles.observationKind}>{insight.type === 'persistent-deviation' ? tr('common.personalRange') : insight.type === 'sleep-consistency' ? tr('insights.consistency') : tr('insights.periodChange')}</Text></View>
    <View style={[styles.observationMain, enlargedText && styles.observationStack]}><View style={styles.observationCopy}><Text style={[styles.observationTitle, leading && styles.leadingTitle]}>{insight.title}</Text>{evidenceValue(insight) ? <Text style={[styles.evidence, { color }]}>{evidenceValue(insight)}</Text> : null}<Text style={styles.explanation}>{insight.explanation}</Text></View>{!compact && series ? <View style={styles.observationSpark}><Sparkline points={series.points} theme={theme} color={color} width={60} height={36} /></View> : null}</View>
    <View style={styles.observationFooter}><Text style={styles.dates}>{formatInsightDate(insight.startDate)} – {formatInsightDate(insight.endDate)}</Text><Text style={styles.coverage}>{tr('format.compactCoverage', { available: insight.evidence.availableDays, expected: insight.evidence.expectedDays })}</Text>{metric ? <View style={styles.observationDestination}><Text style={styles.destinationLabel}>{tr('common.viewDetailsShort')}</Text><Text style={styles.observationArrow}>↗</Text></View> : null}</View>
  </>;
  return metric ? <Pressable accessibilityRole="button" accessibilityLabel={`${meta?.fullLabel}. ${insight.title}. ${insight.explanation}. ${insight.evidence.availableDays} of ${insight.evidence.expectedDays} days. View details.`} onPress={() => { onNavigate?.(); openMetric(metric, insight.endDate); }} style={({ pressed }) => [styles.observation, pressed && styles.pressed]}>{content}</Pressable> : <View style={styles.observation}>{content}</View>;
}

function openMetric(metric: TrendMetricId, date: string) {
  router.push({ pathname: '/metric/[metric]', params: { metric: getMetricMeta()[metric].route, date } });
}

function signalColor(metric: TrendMetricId, theme: AppTheme): string {
  if (metric === 'sleep-duration') return theme.colors.sleep;
  if (metric === 'steps') return theme.colors.activity;
  return theme.colors.accent;
}

function evidenceValue(insight: DeterministicInsight): string | undefined {
  const evidence = insight.evidence;
  if (insight.type === 'persistent-deviation') return evidence.consecutiveDays ? `${evidence.consecutiveDays} days outside your usual range` : undefined;
  if (insight.type === 'sleep-consistency') return evidence.absoluteChange === undefined ? undefined : `${Math.abs(evidence.absoluteChange)} min ${evidence.absoluteChange < 0 ? 'more' : 'less'} consistent`;
  if (evidence.absoluteChange === undefined) return undefined;
  const change = evidence.absoluteChange;
  const amount = insight.metric === 'sleep-duration' ? formatSleepDuration(Math.round(Math.abs(change))) : `${formatNumber(Math.round(Math.abs(change) * 10) / 10)} ${evidence.unit ?? ''}`.trim();
  return `${change >= 0 ? '+' : '−'}${amount} vs previous period`;
}

function formatInsightDate(date: string): string {
  return new Intl.DateTimeFormat(getLocale(), { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

function dateRange(report: TrendReport): string { return `${formatInsightDate(report.startDate)} – ${formatInsightDate(report.endDate)}`; }

function createStyles(theme: AppTheme, compact = false) {
  return StyleSheet.create({
    safeArea: { backgroundColor: theme.colors.background, flex: 1 },
    content: { alignSelf: 'center', maxWidth: theme.layout.contentMaxWidth, paddingBottom: 32, paddingHorizontal: compact ? 16 : 24, paddingTop: 20, width: '100%' },
    pageHeading: { alignItems: 'center', flexDirection: 'row', gap: 16 }, pageCopy: { flex: 1, minWidth: 0 },
    eyebrow: { color: theme.colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1.6 },
    title: { color: theme.colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -1, marginTop: 5 },
    headerSymbol: { alignItems: 'center', backgroundColor: theme.colors.surfaceRaised, borderRadius: 16, flexShrink: 0, height: 44, justifyContent: 'center', width: 44 },
    selector: { marginTop: 20 },
    snapshotSection: { marginTop: 24 },
    snapshotHeading: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
    dates: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 17 },
    recap: { backgroundColor: theme.colors.surface, borderRadius: 22, padding: 12 },
    weeklyRecap: { backgroundColor: theme.colors.surfaceMuted },
    recapRow: { alignItems: 'stretch', flexDirection: 'row', gap: 8 },
    recapStack: { flexDirection: 'column' },
    recapDivider: { backgroundColor: theme.colors.border, height: StyleSheet.hairlineWidth, marginHorizontal: 4, marginVertical: 12 },
    reading: { borderRadius: 12, flex: 1, minHeight: 48, minWidth: 0, padding: 4 },
    readingExpanded: { flex: 0, paddingVertical: 10 },
    readingPressed: { backgroundColor: theme.colors.surfaceRaised, opacity: 0.8 },
    readingIdentity: { alignItems: 'center', flexDirection: 'row', gap: 6, minWidth: 0 },
    snapshotLabel: { color: theme.colors.textSecondary, flexShrink: 1, fontSize: 12, fontWeight: '500', lineHeight: 18 },
    valueLine: { direction: 'ltr', alignItems: 'baseline', alignSelf: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 8, maxWidth: '100%' },
    snapshotValue: { color: theme.colors.text, fontSize: 20, fontVariant: ['tabular-nums'], fontWeight: '600', letterSpacing: -0.5 },
    featuredValue: { fontSize: 30, letterSpacing: -1 },
    missingValue: { color: theme.colors.textMuted, fontSize: 14 },
    unit: { color: theme.colors.textSecondary, fontSize: 10 },
    snapshotContext: { color: theme.colors.textSecondary, fontSize: 10, lineHeight: 16, marginTop: 4 },
    snapshotCoverage: { color: theme.colors.textMuted, fontSize: 10, lineHeight: 16, marginTop: 2 },
    digestLink: { alignItems: 'center', borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, marginTop: 8, minHeight: 68, paddingVertical: 14 },
    digestIcon: { alignItems: 'center', backgroundColor: theme.colors.accentSoft, borderRadius: 13, flexShrink: 0, height: 36, justifyContent: 'center', width: 36 }, digestCopy: { flex: 1, minWidth: 0 },
    digestTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '600' }, digestDate: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 3 },
    chevron: { color: theme.colors.accent, fontSize: 24 },
    feed: { marginTop: 24 },
    observation: { borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 22, paddingTop: 16 },
    observationMeta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
    topic: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 6, minWidth: 0 }, topicGlyph: { alignItems: 'center', flexShrink: 0, justifyContent: 'center', minHeight: 22, width: 20 },
    topicText: { flexShrink: 1, fontSize: 11, fontWeight: '700' }, observationKind: { color: theme.colors.textMuted, fontSize: 10 },
    observationMain: { alignItems: 'center', flexDirection: 'row', gap: 14, marginTop: 10 }, observationStack: { alignItems: 'stretch', flexDirection: 'column' },
    observationCopy: { flex: 1, minWidth: 0 }, observationTitle: { color: theme.colors.text, fontSize: 19, fontWeight: '600', letterSpacing: -0.4, lineHeight: 26 },
    leadingTitle: { fontSize: 22, letterSpacing: -0.6, lineHeight: 29 },
    evidence: { fontSize: 13, fontWeight: '600', lineHeight: 20, marginTop: 6 },
    explanation: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 8 },
    observationSpark: { opacity: 0.8 },
    observationFooter: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
    coverage: { color: theme.colors.textMuted, fontSize: 11 },
    observationDestination: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 6, marginStart: 'auto', minWidth: 0 },
    destinationLabel: { color: theme.colors.accent, flexShrink: 1, fontSize: 11 },
    observationArrow: { color: theme.colors.accent, fontSize: 16 },
    weeklyPattern: { marginTop: 24 },
    pressed: { opacity: 0.6 },
  });
}
