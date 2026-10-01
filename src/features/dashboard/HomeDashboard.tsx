import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appDependencies } from '../../appDependencies';
import type { DailyHealthSummary, LocalDate } from '../../models/health';
import type { DailyBaselineSet } from '../../models/baseline';
import type { RecoveryResult } from '../../models/recovery';
import type { DeterministicInsight } from '../../models/insights';
import type { StoredHealthStats } from '../../database/types';
import type { DevelopmentScenarioId, DevelopmentScenarioState } from '../../services/DashboardDataService';
import { getSystemTimeZone, toLocalDate } from '../../shared/dates/healthDates';
import { createTheme, type AppTheme } from '../../theme/theme';
import { DashboardSection, MetricCard, StatePanel } from './DashboardComponents';
import { buildDashboardViewModel, formatSyncFreshness, getEmptyDashboardMessage, moveDashboardDate } from './dashboardViewModel';

type ScreenPhase = 'initializing' | 'ready' | 'empty' | 'error';

export function HomeDashboard() {
  const systemScheme = useColorScheme();
  const theme = useMemo(() => createTheme(systemScheme !== 'light'), [systemScheme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [phase, setPhase] = useState<ScreenPhase>('initializing');
  const [summary, setSummary] = useState<DailyHealthSummary | null>(null);
  const [baselines, setBaselines] = useState<DailyBaselineSet | null>(null);
  const [recovery, setRecovery] = useState<RecoveryResult | null>(null);
  const [insight, setInsight] = useState<DeterministicInsight | null>(null);
  const [showRecoveryDetails, setShowRecoveryDetails] = useState(false);
  const [stats, setStats] = useState<StoredHealthStats | null>(null);
  const [selectedDate, setSelectedDate] = useState<LocalDate | null>(null);
  const [today, setToday] = useState<LocalDate | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showDevelopmentData, setShowDevelopmentData] = useState(false);
  const [developmentScenarios, setDevelopmentScenarios] = useState<DevelopmentScenarioState | null>(null);
  const [canRefreshEmpty, setCanRefreshEmpty] = useState(false);

  const readPersistedDay = useCallback(async (date: LocalDate, nextStats: StoredHealthStats) => {
    const { dashboardService } = await appDependencies.getPersistence();
    const timeZone = nextStats.sync?.range?.timeZone ?? getSystemTimeZone();
    const result = await dashboardService.readDay(date, timeZone);
    setSummary(result.summary);
    setBaselines(result.baselines);
    setRecovery(result.recovery);
    setInsight(result.insight);
    setShowRecoveryDetails(false);
    setSelectedDate(date);
    setPhase(result.summary ? 'ready' : 'empty');
  }, []);

  const initialize = useCallback(async () => {
    try {
      const { dashboardService } = await appDependencies.getPersistence();
      setError('');
      let nextStats = await dashboardService.getStats();
      nextStats = await dashboardService.bootstrapDevelopmentDataIfEmpty(nextStats);
      setDevelopmentScenarios(dashboardService.getDevelopmentScenarios());
      setCanRefreshEmpty(dashboardService.canRefreshEmptyDatabase());
      const timeZone = nextStats.sync?.range?.timeZone ?? getSystemTimeZone();
      const localToday = toLocalDate(new Date(), timeZone);
      setToday(localToday);
      setStats(nextStats);
      await readPersistedDay(localToday, nextStats);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The local health database could not be opened.');
      setPhase('error');
    }
  }, [readPersistedDay]);

  useEffect(() => { void Promise.resolve().then(initialize); }, [initialize]);

  const refresh = useCallback(async () => {
    if (!selectedDate) return;
    setRefreshing(true);
    setError('');
    try {
      const { dashboardService } = await appDependencies.getPersistence();
      const nextStats = await dashboardService.refresh(selectedDate, stats?.sync?.range?.timeZone ?? getSystemTimeZone());
      setStats(nextStats);
      await readPersistedDay(selectedDate, nextStats);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Refresh failed.');
      setPhase('error');
    } finally {
      setRefreshing(false);
    }
  }, [readPersistedDay, selectedDate, stats]);

  const changeDate = useCallback(async (amount: number) => {
    if (!selectedDate || !stats?.firstDate || !stats.lastDate) return;
    const nextDate = moveDashboardDate(selectedDate, amount, stats.firstDate, stats.lastDate);
    if (nextDate === selectedDate) return;
    setPhase('initializing');
    try {
      await readPersistedDay(nextDate, stats);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That day could not be loaded.');
      setPhase('error');
    }
  }, [readPersistedDay, selectedDate, stats]);

  const selectScenario = useCallback(async (nextScenario: DevelopmentScenarioId) => {
    if (!__DEV__) return;
    setRefreshing(true);
    try {
      const { dashboardService } = await appDependencies.getPersistence();
      const nextStats = await dashboardService.selectDevelopmentScenario(nextScenario);
      const nextDevelopmentScenarios = dashboardService.getDevelopmentScenarios();
      if (!nextStats.firstDate || !nextStats.lastDate || !nextStats.sync?.range) throw new Error('Scenario import produced no persisted date range.');
      setDevelopmentScenarios(nextDevelopmentScenarios);
      const localToday = toLocalDate(new Date(), nextStats.sync.range.timeZone);
      const targetDate = localToday >= nextStats.firstDate && localToday <= nextStats.lastDate ? localToday : nextStats.lastDate;
      setToday(localToday);
      setStats(nextStats);
      await readPersistedDay(targetDate, nextStats);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Scenario import failed.');
      setPhase('error');
    } finally {
      setRefreshing(false);
    }
  }, [readPersistedDay]);

  const showLatest = useCallback(() => {
    if (stats?.lastDate) void readPersistedDay(stats.lastDate, stats);
  }, [readPersistedDay, stats]);

  if (phase === 'initializing') {
    return <ScreenShell theme={theme}><StatePanel loading title="Preparing your dashboard" message="Opening your private on-device health data." theme={theme} /></ScreenShell>;
  }
  if (phase === 'error') {
    return <ScreenShell theme={theme}><StatePanel title="Dashboard unavailable" message={error || 'Something went wrong while reading local health data.'} actionLabel="Try again" onAction={() => { setPhase('initializing'); void initialize(); }} theme={theme} /></ScreenShell>;
  }
  if (phase === 'empty' || !summary || !selectedDate || !today) {
    return (
      <ScreenShell theme={theme}>
        <StatePanel
          title="No data for today"
          message={getEmptyDashboardMessage(stats?.storedDays ?? 0)}
          actionLabel={stats?.lastDate ? 'Show latest data' : canRefreshEmpty ? 'Sync now' : undefined}
          onAction={stats?.lastDate ? showLatest : canRefreshEmpty ? () => void refresh() : undefined}
          theme={theme}
        />
      </ScreenShell>
    );
  }

  const viewModel = buildDashboardViewModel(summary, today, baselines ?? undefined, recovery ?? undefined, insight ?? undefined);
  const syncText = formatSyncFreshness(stats?.sync ?? null, new Date());
  const previousDisabled = !stats?.firstDate || selectedDate <= stats.firstDate;
  const nextDisabled = !stats?.lastDate || selectedDate >= stats.lastDate;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.colors.accent} colors={[theme.colors.accent]} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>HEALTH ANALYTICS</Text>
            <Text style={styles.hero}>{viewModel.dateLabel}</Text>
          </View>
          <View style={styles.syncPill} accessibilityLabel={syncText}>
            <View style={styles.syncDot} />
            <Text style={styles.syncText}>{syncText}</Text>
          </View>
        </View>

        <View style={styles.dayNavigation}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous day" disabled={previousDisabled} onPress={() => void changeDate(-1)} style={({ pressed }) => [styles.dayButton, previousDisabled && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.dayButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.fullDate}>{formatFullDate(selectedDate)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next day" disabled={nextDisabled} onPress={() => void changeDate(1)} style={({ pressed }) => [styles.dayButton, nextDisabled && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.dayButtonText}>›</Text>
          </Pressable>
        </View>

        <DashboardSection theme={theme}>
          <View style={styles.recoveryCard}>
            <View style={styles.recoveryTop}>
              <Text style={styles.cardEyebrow}>RECOVERY</Text>
              {viewModel.recovery.completeness ? <View style={styles.futurePill}><Text style={styles.futurePillText}>{viewModel.recovery.completeness}</Text></View> : null}
            </View>
            <Text style={styles.recoveryTitle}>{viewModel.recovery.title}</Text>
            {viewModel.recovery.category ? <Text style={styles.recoveryCategory}>{viewModel.recovery.category}</Text> : null}
            <Text style={styles.recoveryCopy}>{viewModel.recovery.detail}</Text>
            {viewModel.recovery.details.length ? (
              <>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: showRecoveryDetails }} onPress={() => setShowRecoveryDetails((visible) => !visible)} style={({ pressed }) => [styles.recoveryDetailButton, pressed && styles.pressed]}>
                  <Text style={styles.recoveryDetailButtonText}>{showRecoveryDetails ? 'Hide details' : 'Why this score?'}</Text>
                </Pressable>
                {showRecoveryDetails ? (
                  <View style={styles.recoveryDetails}>
                    {viewModel.recovery.details.map((item) => (
                      <View key={item.signal} style={styles.recoverySignal}>
                        <Text style={styles.recoverySignalTitle}>{item.signal}</Text>
                        {item.current ? <Text style={styles.recoverySignalFact}>Current {item.current}</Text> : null}
                        {item.baseline ? <Text style={styles.recoverySignalFact}>Baseline {item.baseline}</Text> : null}
                        {item.typicalRange ? <Text style={styles.recoverySignalFact}>Typical {item.typicalRange}</Text> : null}
                        {item.contribution ? <Text style={styles.recoveryContribution}>{item.contribution}</Text> : null}
                        {item.weight ? <Text style={styles.recoverySignalMeta}>{item.weight}</Text> : null}
                        <Text style={styles.recoverySignalMeta}>{item.reason}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </DashboardSection>

        <DashboardSection theme={theme}>
          <View style={styles.insightCard}>
            <Text style={styles.cardEyebrow}>TODAY&apos;S INSIGHT</Text>
            <Text style={styles.insightTitle}>{viewModel.insight.title}</Text>
            <Text style={styles.insightCopy}>{viewModel.insight.detail}</Text>
          </View>
        </DashboardSection>

        <DashboardSection theme={theme}>
          <Text style={styles.sectionTitle}>Sleep</Text>
          <View style={styles.sleepCard}>
            <View>
              <Text style={[styles.largeMetric, viewModel.sleep.status !== 'available' && styles.unavailable]}>{viewModel.sleep.value}</Text>
              {viewModel.sleep.detail ? <Text style={styles.metricSupporting}>{viewModel.sleep.detail}</Text> : null}
              {viewModel.sleep.comparison ? <Text style={styles.sleepComparison}>{viewModel.sleep.comparison}</Text> : null}
              {viewModel.sleep.baselineDetail ? <Text style={styles.sleepBaseline}>{viewModel.sleep.baselineDetail}</Text> : null}
            </View>
            {viewModel.sleep.stages ? <Text style={styles.stageText}>{viewModel.sleep.stages}</Text> : null}
          </View>
        </DashboardSection>

        <DashboardSection theme={theme}>
          <Text style={styles.sectionTitle}>Vitals</Text>
          <View style={styles.metricGrid}>
            <MetricCard label="HRV" metric={viewModel.hrv} theme={theme} />
            <MetricCard label="Resting heart rate" metric={viewModel.restingHeartRate} theme={theme} />
            <MetricCard label="Oxygen saturation" metric={viewModel.oxygenSaturation} theme={theme} />
            <MetricCard label="Stress" metric={viewModel.stress} theme={theme} />
          </View>
        </DashboardSection>

        <DashboardSection theme={theme}>
          <Text style={styles.sectionTitle}>Activity</Text>
          <View style={styles.activityCard}>
            <View style={styles.activityMetricRow}>
              <Text style={[styles.largeMetric, viewModel.activity.status !== 'available' && styles.unavailable]}>{viewModel.activity.value}</Text>
              {viewModel.activity.unit ? <Text style={styles.largeMetricUnit}>{viewModel.activity.unit}</Text> : null}
            </View>
            {viewModel.activity.facts.length ? (
              <View style={styles.factRow}>{viewModel.activity.facts.map((fact) => <Text key={fact} style={styles.fact}>{fact}</Text>)}</View>
            ) : null}
          </View>
        </DashboardSection>

        {developmentScenarios ? (
          <DashboardSection theme={theme}>
            <Pressable accessibilityRole="button" accessibilityLabel="Toggle development data scenarios" onPress={() => setShowDevelopmentData((visible) => !visible)} style={({ pressed }) => [styles.devToggle, pressed && styles.pressed]}>
              <Text style={styles.devToggleText}>Development data</Text>
              <Text style={styles.devToggleMeta}>{developmentScenarios.current} {showDevelopmentData ? '−' : '+'}</Text>
            </Pressable>
            {showDevelopmentData ? (
              <View style={styles.devPanel}>
                <Text style={styles.devHelp}>Selecting a scenario resets and reseeds only this development database.</Text>
                <View style={styles.scenarioGrid}>
                  {developmentScenarios.options.map((item) => (
                    <Pressable key={item.id} disabled={refreshing} onPress={() => void selectScenario(item.id)} style={({ pressed }) => [styles.scenarioButton, developmentScenarios.current === item.id && styles.scenarioButtonSelected, pressed && styles.pressed]}>
                      <Text style={[styles.scenarioText, developmentScenarios.current === item.id && styles.scenarioTextSelected]}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </DashboardSection>
        ) : null}

        <Text style={styles.footer}>Wellness information only. No medical interpretation is applied.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ScreenShell({ children, theme }: { children: React.ReactNode; theme: AppTheme }) {
  return (
    <SafeAreaView style={[shellStyles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {children}
    </SafeAreaView>
  );
}

function formatFullDate(date: LocalDate): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00Z`));
}

const shellStyles = StyleSheet.create({ safeArea: { flex: 1 } });

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: { backgroundColor: theme.colors.background, flex: 1 },
    content: { paddingBottom: 56, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xl },
    headerRow: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.md, justifyContent: 'space-between' },
    brand: { color: theme.colors.accent, fontSize: theme.typography.eyebrow, fontWeight: '800', letterSpacing: 1.7 },
    hero: { color: theme.colors.text, fontSize: theme.typography.hero, fontWeight: '700', letterSpacing: -1.2, marginTop: theme.spacing.xs },
    syncPill: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.pill, borderWidth: 1, flexDirection: 'row', gap: 7, maxWidth: 155, minHeight: 36, paddingHorizontal: theme.spacing.md },
    syncDot: { backgroundColor: theme.colors.accent, borderRadius: 4, height: 7, width: 7 },
    syncText: { color: theme.colors.textSecondary, flexShrink: 1, fontSize: 11, fontWeight: '600' },
    dayNavigation: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.xl },
    dayButton: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
    dayButtonText: { color: theme.colors.text, fontSize: 28, lineHeight: 30 },
    fullDate: { color: theme.colors.textSecondary, fontSize: theme.typography.caption, fontWeight: '600' },
    disabled: { opacity: 0.3 },
    pressed: { opacity: 0.72 },
    cardEyebrow: { color: theme.colors.accent, fontSize: theme.typography.eyebrow, fontWeight: '800', letterSpacing: 1.4 },
    recoveryCard: { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, overflow: 'hidden', padding: theme.spacing.xl },
    recoveryTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    futurePill: { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
    futurePillText: { color: theme.colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
    recoveryTitle: { color: theme.colors.text, fontSize: 23, fontWeight: '700', letterSpacing: -0.4, lineHeight: 29, marginTop: theme.spacing.xl, maxWidth: 330 },
    recoveryCategory: { color: theme.colors.accent, fontSize: 15, fontWeight: '800', marginTop: theme.spacing.xs },
    recoveryCopy: { color: theme.colors.textSecondary, fontSize: theme.typography.body, lineHeight: 22, marginTop: theme.spacing.sm, maxWidth: 340 },
    recoveryDetailButton: { alignSelf: 'flex-start', borderColor: theme.colors.border, borderRadius: theme.radii.pill, borderWidth: 1, justifyContent: 'center', marginTop: theme.spacing.lg, minHeight: 44, paddingHorizontal: theme.spacing.lg },
    recoveryDetailButtonText: { color: theme.colors.accent, fontSize: 13, fontWeight: '800' },
    recoveryDetails: { gap: theme.spacing.sm, marginTop: theme.spacing.lg },
    recoverySignal: { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.md, padding: theme.spacing.md },
    recoverySignalTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
    recoverySignalFact: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 },
    recoveryContribution: { color: theme.colors.accent, fontSize: 12, fontWeight: '800', marginTop: theme.spacing.sm },
    recoverySignalMeta: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
    insightCard: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, padding: theme.spacing.xl },
    insightTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700', lineHeight: 24, marginTop: theme.spacing.lg },
    insightCopy: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: theme.spacing.sm },
    sectionTitle: { color: theme.colors.text, fontSize: 19, fontWeight: '700', letterSpacing: -0.25, marginBottom: theme.spacing.md },
    sleepCard: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, gap: theme.spacing.xl, padding: theme.spacing.xl },
    largeMetric: { color: theme.colors.text, fontSize: 34, fontWeight: '700', letterSpacing: -0.8 },
    largeMetricUnit: { color: theme.colors.textSecondary, fontSize: theme.typography.body, fontWeight: '600', marginBottom: 5 },
    unavailable: { color: theme.colors.textSecondary, fontSize: 19, letterSpacing: 0 },
    metricSupporting: { color: theme.colors.textSecondary, fontSize: theme.typography.body, marginTop: theme.spacing.xs },
    sleepComparison: { color: theme.colors.accent, fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: theme.spacing.md },
    sleepBaseline: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: theme.spacing.xs },
    stageText: { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.md, color: theme.colors.textSecondary, fontSize: theme.typography.caption, lineHeight: 20, overflow: 'hidden', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
    activityCard: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, padding: theme.spacing.xl },
    activityMetricRow: { alignItems: 'flex-end', flexDirection: 'row', gap: theme.spacing.sm },
    factRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.xl },
    fact: { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.pill, color: theme.colors.textSecondary, fontSize: theme.typography.caption, overflow: 'hidden', paddingHorizontal: theme.spacing.md, paddingVertical: 8 },
    devToggle: { alignItems: 'center', borderColor: theme.colors.border, borderRadius: theme.radii.md, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: theme.spacing.lg },
    devToggleText: { color: theme.colors.textSecondary, fontSize: theme.typography.caption, fontWeight: '700' },
    devToggleMeta: { color: theme.colors.textMuted, fontSize: 11, textTransform: 'capitalize' },
    devPanel: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md, borderTopWidth: 0, borderWidth: 1, marginTop: -1, padding: theme.spacing.lg },
    devHelp: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 },
    scenarioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.md },
    scenarioButton: { borderColor: theme.colors.border, borderRadius: theme.radii.pill, borderWidth: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: theme.spacing.md },
    scenarioButtonSelected: { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accentStrong },
    scenarioText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
    scenarioTextSelected: { color: theme.colors.accent, fontWeight: '800' },
    footer: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: theme.spacing.xxl, textAlign: 'center' },
  });
}
