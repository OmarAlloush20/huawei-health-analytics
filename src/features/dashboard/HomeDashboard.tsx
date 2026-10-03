import { getLocale, tr } from '../../localization/i18n';
import { Text, View, Pressable } from '../../localization/LocalizedNative';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appDependencies } from '../../appDependencies';
import { AppIcon, BrandMark, type AppIconName } from '../../components/AppIcon';
import { CompactState, ProductSheet, Reveal, SectionLabel } from '../../components/ProductUI';
import { MovementBars, SleepComposition, Sparkline } from '../../components/SignalVisuals';
import type { StoredHealthStats } from '../../database/types';
import type { DailyHealthSummary, LocalDate } from '../../models/health';
import type { TrendReport } from '../../models/trends';
import { FOCUS_METRICS, MAX_FOCUS_METRICS, type FocusMetric } from '../../repositories/ProductPreferencesRepository';
import type { DashboardDayData } from '../../services/DashboardDataService';
import { addLocalDays, getSystemTimeZone, toLocalDate } from '../../shared/dates/healthDates';
import { formatNumber } from '../../shared/formatters/healthFormatters';
import { getResponsiveLayout } from '../../theme/responsive';
import { useAppTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/theme';
import { buildTrendsViewModel } from '../trends/trendViewModel';
import { DateHistoryPicker } from './DateHistoryPicker';
import { DateNavigator } from './DateNavigator';
import { TodayRecovery } from './TodayRecovery';
import { buildDashboardViewModel, formatSyncFreshness, type MetricDisplay } from './dashboardViewModel';
import { compactFreshness, formatSelectedDate, readingPoints, shortBaseline } from './todayPresentation';

interface TodayData { day: DashboardDayData; history: DailyHealthSummary[]; week: TrendReport }
function getFocusMeta(): Record<FocusMetric, { label: string; full: string; icon: AppIconName }> { return {
  hrv: { label: tr('metric.hrv'), full: tr('metric.hrvFull'), icon: 'hrv' },
  rhr: { label: tr('metric.rhr'), full: tr('metric.rhrFull'), icon: 'heart' },
  sleep: { label: tr('metric.sleep'), full: tr('metric.sleep'), icon: 'sleep' },
  spo2: { label: tr('metric.spo2'), full: tr('metric.oxygen'), icon: 'oxygen' },
  stress: { label: tr('metric.stress'), full: tr('metric.stress'), icon: 'stress' },
  activity: { label: tr('metric.activity'), full: tr('metric.activity'), icon: 'activity' },
}; }

export function HomeDashboard() {
  const { theme } = useAppTheme();
  const { width, fontScale } = useWindowDimensions();
  const layout = getResponsiveLayout(width, fontScale);
  const styles = useMemo(() => createStyles(theme, layout.singleColumn), [layout.singleColumn, theme]);
  const [data, setData] = useState<TodayData | null>(null);
  const [stats, setStats] = useState<StoredHealthStats | null>(null);
  const [date, setDate] = useState<LocalDate | null>(null);
  const selectedRef = useRef<LocalDate | null>(null);
  const request = useRef(0);
  const [dates, setDates] = useState<LocalDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [calendar, setCalendar] = useState(false);
  const [sheet, setSheet] = useState<'focus' | 'week' | 'freshness' | null>(null);
  const [focus, setFocus] = useState<FocusMetric[]>([]);
  const [draftFocus, setDraftFocus] = useState<FocusMetric[]>([]);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const timeZone = stats?.sync?.range?.timeZone ?? getSystemTimeZone();
  const today = toLocalDate(new Date(), timeZone);

  const readDate = useCallback(async (next: LocalDate, nextStats: StoredHealthStats, id: number) => {
    const { dashboardService, repository, trendsService } = await appDependencies.getPersistence();
    if (id !== request.current) return;
    const zone = nextStats.sync?.range?.timeZone ?? getSystemTimeZone();
    const [day, history, week] = await Promise.all([
      dashboardService.readDay(next, zone),
      repository.getDailySummaries(nextStats.provider, { start: addLocalDays(next, -6), end: next, timeZone: zone }),
      trendsService.getReport('7d', next, zone),
    ]);
    if (id !== request.current) return;
    selectedRef.current = next;
    setDate(next); setData({ day, history, week }); setStats(nextStats); setExpanded(false);
  }, []);

  const initialize = useCallback(async (id = ++request.current) => {
    try {
      const { dashboardService, repository, productPreferences } = await appDependencies.getPersistence();
      let nextStats = await dashboardService.getStats();
      if (id !== request.current) return;
      nextStats = await dashboardService.bootstrapDevelopmentDataIfEmpty(nextStats);
      if (id !== request.current) return;
      const zone = nextStats.sync?.range?.timeZone ?? getSystemTimeZone();
      const [history, chosen] = await Promise.all([
        nextStats.firstDate && nextStats.lastDate ? repository.getDailySummaries(nextStats.provider, { start: nextStats.firstDate, end: nextStats.lastDate, timeZone: zone }) : Promise.resolve([]),
        productPreferences.getFocusMetrics(),
      ]);
      if (id !== request.current) return;
      const available = history.map((summary) => summary.date).sort();
      setStats(nextStats); setDates(available); setFocus(chosen);
      const localToday = toLocalDate(new Date(), zone);
      const target = selectedRef.current && available.includes(selectedRef.current) ? selectedRef.current : available.includes(localToday) ? localToday : available.at(-1);
      if (target) await readDate(target, nextStats, id); else { selectedRef.current = localToday; setData(null); setDate(localToday); }
      if (id === request.current) setError('');
    } catch { if (id === request.current) setError(tr('error.openDay')); }
    finally { if (id === request.current) { setLoading(false); setRefreshing(false); } }
  }, [readDate]);

  useFocusEffect(useCallback(() => { void initialize(); return () => { request.current += 1; }; }, [initialize]));

  const selectDate = async (next: LocalDate) => {
    if (!stats) return;
    const id = ++request.current;
    setLoading(true); setRefreshing(false); setError('');
    try { await readDate(next, stats, id); } catch { if (id === request.current) setError(tr('error.day')); }
    finally { if (id === request.current) setLoading(false); }
  };

  const refresh = async () => {
    if (!date) return;
    const id = ++request.current;
    setRefreshing(true);
    try {
      const { dashboardService } = await appDependencies.getPersistence();
      await dashboardService.refresh(date, timeZone);
      if (id === request.current) await initialize(id);
    } catch { if (id === request.current) setError(tr('error.sync')); }
    finally { if (id === request.current) setRefreshing(false); }
  };

  const saveFocus = async () => {
    setSaving(true);
    try { const { productPreferences } = await appDependencies.getPersistence(); await productPreferences.setFocusMetrics(draftFocus); setFocus(draftFocus); setSheet(null); }
    catch { setError(tr('error.focus')); }
    finally { setSaving(false); }
  };

  const summary = data?.day.summary;
  const view = summary ? buildDashboardViewModel(summary, today, data?.day.baselines ?? undefined, data?.day.recovery ?? undefined, data?.day.insight ?? undefined) : null;
  const index = date ? dates.indexOf(date) : -1;
  const openMetric = (metric: FocusMetric | 'recovery') => router.push({ pathname: '/metric/[metric]', params: { metric, date: date ?? undefined } });
  const display = (metric: FocusMetric): MetricDisplay | null => !view ? null : metric === 'hrv' ? view.hrv : metric === 'rhr' ? view.restingHeartRate : metric === 'spo2' ? view.oxygenSaturation : metric === 'stress' ? view.stress : metric === 'sleep' ? view.sleep : view.activity;
  const sleep = summary?.sleep.status === 'available' ? summary.sleep.value : null;
  const activity = summary?.activity.status === 'available' ? summary.activity.value : null;
  const weekView = data ? buildTrendsViewModel(data.week) : null;

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <StatusBar style={theme.dark ? 'light' : 'dark'} />
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: layout.compact ? 16 : 24 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.colors.accent} colors={[theme.colors.accent]} />}>
      <View style={styles.identity}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr('today.freshness')} onPress={() => setSheet('freshness')} style={({ pressed }) => [styles.brand, layout.enlargedText && { flexBasis: '100%' }, pressed && styles.pressed]}><BrandMark size={26} color={theme.colors.accent} secondary={theme.colors.accentStrong} /><View style={styles.brandCopy}><Text style={styles.brandName}>{tr('brand.short')}</Text><View style={styles.freshness}><View style={[styles.statusDot, { backgroundColor: error || stats?.sync?.status === 'failed' ? theme.colors.warning : theme.colors.accent }]} /><Text style={styles.freshnessText}>{compactFreshness(stats?.sync ?? null, new Date(), stats?.provider === 'mock')}</Text></View></View></Pressable>
        <Pressable accessibilityLabel={tr('today.openWeek')} accessibilityRole="button" onPress={() => setSheet('week')} style={({ pressed }) => [styles.weekButton, pressed && styles.pressed]}><AppIcon name="trends" color={theme.colors.accent} size={16} /><Text style={styles.weekButtonText}>{tr('today.week')}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tr('today.customize')} onPress={() => { setDraftFocus(focus); setSheet('focus'); }} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><AppIcon name="settings" color={theme.colors.textSecondary} size={19} /></Pressable>
      </View>
      <DateNavigator previousLabel={tr('calendar.previousDay')} nextLabel={tr('calendar.nextDay')} previousDisabled={index <= 0 || loading} nextDisabled={index < 0 || index >= dates.length - 1 || loading} onPrevious={() => void selectDate(dates[index - 1])} onNext={() => void selectDate(dates[index + 1])} theme={theme}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr('format.openCalendar', { date: date ?? today })} onPress={() => setCalendar(true)} style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}><Text style={[styles.dateText, { textAlign: 'center' }]}>{formatSelectedDate(date ?? today, width, fontScale)}</Text><Text style={[styles.dateHint, { textAlign: 'center' }]}>{date === today ? tr('nav.today') : tr('common.history')} ⌄</Text></Pressable>
      </DateNavigator>


      {error ? <CompactState title={data ? tr('today.syncAttention') : tr('today.dataUnavailable')} message={error} icon="alert" action={tr('common.retry')} onAction={() => void (data ? refresh() : initialize())} theme={theme} /> : null}
      {loading ? <CompactState loading title={tr('today.opening')} theme={theme} /> : null}
      {!loading && !summary ? <CompactState title={tr('today.noReadings')} message={tr('today.syncHelp')} icon="trends" action={dates.length ? tr('today.openHistory') : appDependencies.healthProvider.id === 'huawei' ? tr('today.syncNow') : undefined} onAction={() => dates.length ? setCalendar(true) : void refresh()} theme={theme} /> : null}

      {!loading && summary && view && data ? <Reveal identity={date ?? undefined}>
        <TodayRecovery recovery={data.day.recovery} presentation={view.recovery} average={weekView?.cards[0].headline !== tr('common.noUsableData') ? weekView?.cards[0].headline : undefined} expanded={expanded} onExpand={() => setExpanded(!expanded)} onOpen={openMetric} theme={theme} />

        {focus.length ? <View style={styles.focusSection}><Text style={styles.focusCaption}>{tr('today.focus')}</Text><View style={styles.focusGrid}>{focus.map((metric) => { const item = display(metric)!; return <Pressable key={metric} accessibilityRole="button" accessibilityLabel={`${getFocusMeta()[metric].full}, ${readingLabel(metric, item)}`} accessibilityHint={tr('today.focusShortcut')} onPress={() => openMetric(metric)} style={({ pressed }) => [styles.focusItem, pressed && styles.pressed]}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={[styles.focusLabel, { flex: 1 }]}>{getFocusMeta()[metric].label}</Text><Text style={{ color: theme.colors.textMuted }}>›</Text></View><Text style={styles.focusValue}>{readingLabel(metric, item)}</Text></Pressable>; })}</View></View> : null}

        <View style={styles.sleepSection}><SectionLabel title={tr('today.night')} action={tr('metric.sleep')} onAction={() => openMetric('sleep')} theme={theme} />
          {sleep ? <Pressable accessibilityRole="button" onPress={() => openMetric('sleep')} style={({ pressed }) => [styles.sleepModule, pressed && styles.pressed]}><View style={styles.sleepTop}><View style={styles.sleepIdentity}><AppIcon name="sleep" color={theme.colors.sleep} size={25} /><View style={{ flexShrink: 1, maxWidth: '100%' }}><Text style={styles.sleepDuration}>{view.sleep.value}</Text><Text style={styles.sleepTiming}>{view.sleep.detail ?? tr('today.noTiming')}</Text></View></View>{sleep.score !== undefined ? <View style={styles.sleepScore}><Text style={styles.sleepScoreValue}>{sleep.score}</Text><Text style={styles.sleepScoreCaption}>{tr('today.sleepScore')}</Text></View> : null}</View><SleepComposition sleep={sleep} theme={theme} compact /><Text style={styles.sleepBaseline}>{shortBaseline(data.day.baselines?.sleepDuration, true)}</Text></Pressable> : <CompactState icon="sleep" title={shortAvailability(view.sleep)} theme={theme} />}
        </View>

        <View style={styles.vitalsSection}><SectionLabel title={tr('today.signals')} action={tr('today.allTrends')} onAction={() => router.push('/trends')} theme={theme} /><View style={styles.signalPanel}>{(['hrv', 'rhr', 'spo2', 'stress'] as FocusMetric[]).map((metric) => { const item = display(metric)!; const baseline = metric === 'hrv' ? data.day.baselines?.hrv : metric === 'rhr' ? data.day.baselines?.restingHeartRate : undefined; const points = readingPoints(metric, data.history, summary.date, summary.timeZone); return <Pressable key={metric} accessibilityRole="button" accessibilityLabel={`${getFocusMeta()[metric].full}, ${readingLabel(metric, item)}, ${baseline ? shortBaseline(baseline) : ''}`} onPress={() => openMetric(metric)} style={({ pressed }) => [styles.signalRow, item.status !== 'available' && styles.signalMissing, pressed && styles.pressed]}><AppIcon name={getFocusMeta()[metric].icon} color={item.status === 'available' ? theme.colors.accent : theme.colors.textMuted} size={20} /><View style={styles.signalIdentity}><Text style={styles.signalName}>{getFocusMeta()[metric].label}</Text>{baseline ? <Text style={styles.signalContext}>{shortBaseline(baseline)}</Text> : item.status === 'available' ? null : <Text style={styles.signalContext}>{shortAvailability(item)}</Text>}</View><View style={styles.signalValueGroup}><Text style={[styles.signalValue, item.status !== 'available' && styles.missingValue]}>{item.status === 'available' ? item.value : '—'}{item.status === 'available' && item.unit ? <Text style={styles.signalUnit}>{metric === 'hrv' ? ' ms' : ` ${item.unit}`}</Text> : null}</Text></View>{item.status === 'available' && !layout.enlargedText ? <Sparkline points={points} theme={theme} width={54} height={24} /> : null}<Text style={styles.signalChevron}>›</Text></Pressable>; })}</View></View>

        <View style={styles.activitySection}><SectionLabel title={tr('today.movement')} action={tr('metric.activity')} onAction={() => openMetric('activity')} theme={theme} />{activity ? <Pressable accessibilityRole="button" onPress={() => openMetric('activity')} style={({ pressed }) => [styles.activityModule, pressed && styles.pressed]}><View style={styles.movementTop}><View><Text style={styles.activityValue}>{formatNumber(activity.steps)}</Text><Text style={styles.activityCaption}>{'steps'}</Text></View><View style={styles.movementPlot}><MovementBars points={readingPoints('activity', data.history, summary.date, summary.timeZone)} theme={theme} height={84} selectedDate={summary.date} /></View></View><View style={styles.activityFacts}>{[{ value: activity.activeDurationMinutes === undefined ? '—' : `${activity.activeDurationMinutes} min`, label: tr('today.active') }, { value: activity.activeEnergyKcal === undefined ? '—' : `${formatNumber(activity.activeEnergyKcal)} kcal`, label: tr('today.energy') }, { value: activity.workoutCount === undefined ? '—' : String(activity.workoutCount), label: tr('today.workouts') }].map((item) => <View key={item.label} style={styles.activityFact}><Text style={styles.factValue}>{item.value}</Text><Text style={styles.factLabel}>{item.label}</Text></View>)}</View></Pressable> : <CompactState title={shortAvailability(view.activity)} icon="activity" theme={theme} />}</View>

        <Pressable accessibilityRole="button" onPress={() => data.day.insight?.metric ? openMetric(data.day.insight.metric === 'recovery' ? 'recovery' : data.day.insight.metric === 'sleep-duration' ? 'sleep' : data.day.insight.metric === 'hrv-rmssd' ? 'hrv' : data.day.insight.metric === 'resting-heart-rate' ? 'rhr' : 'activity') : router.push('/insights')} style={({ pressed }) => [styles.pattern, pressed && styles.pressed]}><AppIcon name="insights" color={theme.colors.accent} size={23} /><View style={styles.patternCopy}><Text style={styles.kicker}>{tr('today.pattern')}</Text><Text style={styles.patternTitle}>{view.insight.available ? view.insight.title : tr('today.weekGlance')}</Text><Text style={styles.patternDetail}>{view.insight.available ? view.insight.detail : tr('today.weekContext')}</Text></View><Text style={styles.signalChevron}>›</Text></Pressable>
      </Reveal> : null}
    </ScrollView>

    {calendar ? <DateHistoryPicker visible selectedDate={date ?? today} today={today} availableDates={dates} onClose={() => setCalendar(false)} onSelect={(next) => { setCalendar(false); void selectDate(next); }} theme={theme} /> : null}
    <ProductSheet visible={sheet === 'focus'} onClose={() => setSheet(null)} title={tr('today.customize')} subtitle={tr('today.customizeHelp')} theme={theme}>{FOCUS_METRICS.map((metric) => { const selected = draftFocus.includes(metric); return <Pressable key={metric} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: saving || (!selected && draftFocus.length >= MAX_FOCUS_METRICS) }} disabled={saving || (!selected && draftFocus.length >= MAX_FOCUS_METRICS)} onPress={() => setDraftFocus(selected ? draftFocus.filter((value) => value !== metric) : [...draftFocus, metric])} style={({ pressed }) => [styles.option, pressed && styles.pressed]}><AppIcon name={getFocusMeta()[metric].icon} color={selected ? theme.colors.accent : theme.colors.textSecondary} size={21} /><Text style={styles.optionLabel}>{getFocusMeta()[metric].full}</Text><Text style={styles.optionCheck}>{selected ? '✓' : '+'}</Text></Pressable>; })}<Pressable accessibilityRole="button" disabled={saving} onPress={() => void saveFocus()} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}><Text style={styles.saveText}>{saving ? tr('today.saving') : tr('today.save')}</Text></Pressable></ProductSheet>
    <ProductSheet visible={sheet === 'week'} onClose={() => setSheet(null)} title={tr('today.week')} subtitle={data ? `${formatSelectedDate(data.week.startDate, 360, 1)} – ${formatSelectedDate(data.week.endDate, 360, 1)} · last seven days` : tr('today.weekHelp')} theme={theme}>{weekView ? <>{weekView.cards.map((item) => <Pressable accessibilityRole="button" key={item.metric} onPress={() => { setSheet(null); openMetric(item.metric === 'recovery' ? 'recovery' : item.metric === 'sleep-duration' ? 'sleep' : item.metric === 'hrv-rmssd' ? 'hrv' : item.metric === 'resting-heart-rate' ? 'rhr' : 'activity'); }} style={({ pressed }) => [styles.weekFact, pressed && styles.pressed]}><View style={{ flex: 1 }}><Text style={styles.weekLabel}>{item.label}</Text><Text style={styles.weekCoverage}>{item.coverage}</Text></View><View style={{ alignItems: 'flex-end', flex: 1 }}><Text style={styles.weekValue}>{item.headline}{item.unit && item.headline !== tr('common.noUsableData') ? ` ${item.unit}` : ''}</Text><Text style={styles.weekChange}>{item.comparison}</Text></View></Pressable>)}{data?.day.insight ? <View style={{ marginTop: 20 }}><Text style={styles.kicker}>{tr('today.strongest')}</Text><Text style={styles.patternTitle}>{data.day.insight.title}</Text><Text style={styles.reason}>{data.day.insight.explanation}</Text></View> : null}</> : <CompactState title={tr('today.weekNeedsData')} message={tr('today.weekAfterSync')} theme={theme} />}</ProductSheet>
    <ProductSheet visible={sheet === 'freshness'} onClose={() => setSheet(null)} title={tr('today.data')} theme={theme}>
      <Text style={styles.reason}>{tr('format.source', { source: appDependencies.healthProvider.id === 'mock' ? tr('state.mockSynthetic') : appDependencies.healthProvider.displayName })}</Text>
      <Text style={styles.reason}>{formatSyncFreshness(stats?.sync ?? null, new Date())}</Text>
      <Text style={styles.reason}>{stats?.sync?.lastSuccessfulAt ? tr('format.lastSync', { date: new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(stats.sync.lastSuccessfulAt)) }) : tr('state.notSynced')}</Text>
      <Text style={styles.reason}>{tr('format.savedDays', { count: stats?.storedDays ?? 0 })}</Text>
      <Text style={styles.reason}>{appDependencies.healthProvider.id === 'mock' ? tr('today.mockDisclosure') : tr('today.huaweiStepOnly')}</Text>
      {stats?.sync?.error ? <Text style={styles.reason}>{tr('error.sync')}</Text> : null}
      <Text style={styles.reason}>{tr(refreshing || stats?.sync?.status === 'running' ? 'today.refreshBusy' : date ? 'today.refreshAvailable' : 'today.refreshUnavailable')}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !date || refreshing || stats?.sync?.status === 'running' }} disabled={!date || refreshing || stats?.sync?.status === 'running'} onPress={() => void refresh()} style={({ pressed }) => [styles.saveButton, { opacity: !date || refreshing || stats?.sync?.status === 'running' ? 0.45 : pressed ? 0.65 : 1 }]}><Text style={styles.saveText}>{refreshing ? tr('state.refreshing') : tr('today.syncNow')}</Text></Pressable>
    </ProductSheet>
  </SafeAreaView>;
}

function readingLabel(metric: FocusMetric, item: MetricDisplay) { return item.status === 'available' ? `${item.value}${metric === 'hrv' ? ' ms' : item.unit ? ` ${item.unit}` : ''}` : shortAvailability(item); }

function shortAvailability(metric: MetricDisplay) { return metric.status === 'unsupported' ? tr('common.unavailable') : metric.status === 'query-failed' ? tr('common.readingFailed') : tr('common.noReading'); }

function createStyles(theme: AppTheme, stacked: boolean) { return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background }, content: { alignSelf: 'center', maxWidth: 720, width: '100%', paddingTop: 12, paddingBottom: 32 },
  identity: { flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', gap: 8 }, brand: { alignItems: 'center', flexGrow: 1, flexShrink: 1, minWidth: 120, minHeight: 48, flexDirection: 'row', gap: 8 }, brandCopy: { flex: 1, minWidth: 0 }, brandName: { color: theme.colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 }, freshness: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 4 }, statusDot: { borderRadius: 3, width: 5, height: 5 }, freshnessText: { color: theme.colors.textMuted, fontSize: 10, flexShrink: 1 }, iconButton: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48, backgroundColor: theme.colors.surface, borderRadius: 16 },
  dateButton: { justifyContent: 'center', minHeight: 48, alignItems: 'center' }, dateText: { color: theme.colors.text, fontSize: 17, fontWeight: '600' }, dateHint: { color: theme.colors.textMuted, fontSize: 10, marginTop: 2 }, weekButton: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSoft, borderRadius: 14, minHeight: 48, paddingHorizontal: 10 }, weekButtonText: { color: theme.colors.accent, fontSize: 11, fontWeight: '700' },
  kicker: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.1 }, whyAction: { color: theme.colors.accent, fontSize: 11, fontWeight: '600' }, reason: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 12 },

  focusSection: { marginTop: 14 }, focusCaption: { color: theme.colors.textMuted, fontSize: 11, marginBottom: 8, fontWeight: '600' }, focusGrid: { backgroundColor: theme.colors.surfaceMuted, borderRadius: 16, padding: 4, flexDirection: stacked ? 'column' : 'row', flexWrap: 'wrap', gap: 4 }, focusItem: { padding: 10, minHeight: 48, flex: stacked ? undefined : 1, minWidth: 118, borderRadius: 12 }, focusLabel: { color: theme.colors.textSecondary, fontSize: 10 }, focusValue: { color: theme.colors.text, fontSize: 16, fontWeight: '600', marginTop: 4, fontVariant: ['tabular-nums'] },
  sleepSection: { marginTop: 16 }, sleepModule: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 16 }, sleepTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }, sleepIdentity: { flexShrink: 1, minWidth: 0, flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', gap: 10 }, sleepDuration: { direction: 'ltr', writingDirection: 'ltr', color: theme.colors.text, fontSize: 32, fontWeight: '500', letterSpacing: -1 }, sleepTiming: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 4 }, sleepScore: { alignItems: 'flex-end', borderStartColor: theme.colors.border, borderStartWidth: StyleSheet.hairlineWidth, paddingStart: 12 }, sleepScoreValue: { color: theme.colors.sleep, fontSize: 24, fontWeight: '600', fontVariant: ['tabular-nums'] }, sleepScoreCaption: { color: theme.colors.textMuted, fontSize: 10 }, sleepBaseline: { color: theme.colors.sleep, fontSize: 11, marginTop: 12 },
  vitalsSection: { marginTop: 18 }, signalPanel: { backgroundColor: theme.colors.surface, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 4 }, signalRow: { alignItems: 'center', borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 8, minHeight: 66, paddingVertical: 10, flexWrap: stacked ? 'wrap' : undefined }, signalMissing: { minHeight: 48, borderBottomWidth: 0 }, signalIdentity: { flex: 1, minWidth: 60 }, signalName: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' }, signalContext: { color: theme.colors.textMuted, fontSize: 10, lineHeight: 16, marginTop: 3 }, signalValueGroup: { direction: 'ltr', alignItems: 'flex-end', maxWidth: '100%' }, signalValue: { direction: 'ltr', writingDirection: 'ltr', color: theme.colors.text, fontSize: 21, fontWeight: '600', fontVariant: ['tabular-nums'] }, signalUnit: { color: theme.colors.textSecondary, fontSize: 11 }, missingValue: { color: theme.colors.textMuted, fontSize: 17 }, signalChevron: { color: theme.colors.textMuted, fontSize: 19 },
  activitySection: { marginTop: 18 }, activityModule: { paddingVertical: 4 }, movementTop: { flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' }, activityValue: { color: theme.colors.text, fontSize: 38, fontWeight: '500', letterSpacing: -1.5 }, activityCaption: { color: theme.colors.activity, fontSize: 12, marginTop: 3 }, movementPlot: { flex: 1, minWidth: 128 }, activityFacts: { flexDirection: 'row', flexWrap: 'wrap', borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 12, gap: 12 }, activityFact: { flex: stacked ? undefined : 1, minWidth: stacked ? '100%' : 80 }, factValue: { color: theme.colors.text, fontSize: 16, fontWeight: '500' }, factLabel: { color: theme.colors.textMuted, fontSize: 10, marginTop: 4 },
  pattern: { borderStartColor: theme.colors.accentMuted, borderStartWidth: 3, marginTop: 28, paddingVertical: 6, paddingStart: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, patternCopy: { flex: 1 }, patternTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '600', lineHeight: 27, marginTop: 6 }, patternDetail: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 7 },
  option: { alignItems: 'center', borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 60, gap: 12 }, optionLabel: { color: theme.colors.text, fontSize: 14, flex: 1 }, optionCheck: { color: theme.colors.accent, fontSize: 20 }, saveButton: { alignItems: 'center', backgroundColor: theme.colors.accentStrong, borderRadius: 14, justifyContent: 'center', minHeight: 52, marginTop: 20 }, saveText: { color: theme.colors.onAccent, fontSize: 14, fontWeight: '700' }, weekFact: { flexWrap: 'wrap', borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: stacked ? 'column' : 'row', gap: 16, paddingVertical: 14 }, weekLabel: { color: theme.colors.textSecondary, fontSize: 13 }, weekCoverage: { color: theme.colors.textMuted, fontSize: 10, marginTop: 4 }, weekValue: { color: theme.colors.text, fontSize: 16, fontWeight: '600', textAlign: 'right' }, weekChange: { color: theme.colors.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 4, textAlign: 'right' },
  pressed: { opacity: 0.6 }, disabled: { opacity: 0.25 },
}); }
