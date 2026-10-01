import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appDependencies } from '../../appDependencies';
import type { TrendRangeId, TrendReport } from '../../models/trends';
import { getSystemTimeZone } from '../../shared/dates/healthDates';
import { createTheme, type AppTheme } from '../../theme/theme';
import { RangeSelector } from './RangeSelector';
import { TrendChart } from './TrendChart';
import { buildTrendsViewModel } from './trendViewModel';

export function TrendsScreen() {
  const scheme = useColorScheme();
  const theme = useMemo(() => createTheme(scheme !== 'light'), [scheme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [range, setRange] = useState<TrendRangeId>('7d');
  const [report, setReport] = useState<TrendReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (nextRange: TrendRangeId, refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const { dashboardService, trendsService } = await appDependencies.getPersistence();
      let stats = await dashboardService.getStats();
      stats = await dashboardService.bootstrapDevelopmentDataIfEmpty(stats);
      if (!stats.lastDate) { setReport(null); return; }
      const timeZone = stats.sync?.range?.timeZone ?? getSystemTimeZone();
      setReport(await trendsService.getReport(nextRange, stats.lastDate, timeZone));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Trends could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(() => load(range)); }, [load, range]);
  const viewModel = report ? buildTrendsViewModel(report) : null;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(range, true)} tintColor={theme.colors.accent} colors={[theme.colors.accent]} />}>
        <Text style={styles.eyebrow}>HISTORY</Text>
        <Text style={styles.title}>Trends</Text>
        <Text style={styles.subtitle}>Your measurements over time, without filling in missing days.</Text>
        <View style={styles.selector}><RangeSelector value={range} onChange={setRange} theme={theme} /></View>

        {loading ? <View style={styles.state}><ActivityIndicator color={theme.colors.accent} /><Text style={styles.stateText}>Calculating historical baselines…</Text></View> : null}
        {error ? <View style={styles.state}><Text style={styles.errorTitle}>Trends unavailable</Text><Text style={styles.stateText}>{error}</Text></View> : null}
        {!loading && !error && !viewModel ? <View style={styles.state}><Text style={styles.errorTitle}>No history yet</Text><Text style={styles.stateText}>Trend data will appear after a successful sync.</Text></View> : null}

        {viewModel ? (
          <>
            <View style={styles.consistencyCard}><Text style={styles.consistencyLabel}>BEDTIME CONSISTENCY</Text><Text style={styles.consistencyText}>{viewModel.consistency}</Text></View>
            {viewModel.cards.map((card) => (
              <View key={card.metric} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View><Text style={styles.cardLabel}>{card.label}</Text><View style={styles.metricRow}><Text style={styles.metric}>{card.headline}</Text>{card.unit ? <Text style={styles.unit}>{card.unit}</Text> : null}</View></View>
                  <Text style={styles.coverage}>{card.coverage}</Text>
                </View>
                <View style={styles.chart}><TrendChart points={card.points} theme={theme} accessibilityLabel={`${card.label}. ${card.coverage}. ${card.comparison}.`} /></View>
                <Text style={styles.comparison}>{card.comparison}</Text>
              </View>
            ))}
          </>
        ) : null}
        <Text style={styles.footer}>Trends describe recorded personal data. They are not medical interpretation.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: { backgroundColor: theme.colors.background, flex: 1 },
    content: { paddingBottom: theme.spacing.xxxl, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xl },
    eyebrow: { color: theme.colors.accent, fontSize: theme.typography.eyebrow, fontWeight: '800', letterSpacing: 1.7 },
    title: { color: theme.colors.text, fontSize: theme.typography.hero, fontWeight: '700', letterSpacing: -1.1, marginTop: theme.spacing.xs },
    subtitle: { color: theme.colors.textSecondary, fontSize: theme.typography.body, lineHeight: 22, marginTop: theme.spacing.sm, maxWidth: 360 },
    selector: { marginTop: theme.spacing.xl },
    state: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, marginTop: theme.spacing.xl, padding: theme.spacing.xxl },
    stateText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: theme.spacing.sm, textAlign: 'center' },
    errorTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '700' },
    consistencyCard: { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radii.lg, marginTop: theme.spacing.xl, padding: theme.spacing.lg },
    consistencyLabel: { color: theme.colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
    consistencyText: { color: theme.colors.text, fontSize: 14, fontWeight: '600', lineHeight: 20, marginTop: theme.spacing.sm },
    card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, marginTop: theme.spacing.lg, padding: theme.spacing.lg },
    cardHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'space-between' },
    cardLabel: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700' },
    metricRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 6, marginTop: theme.spacing.xs },
    metric: { color: theme.colors.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
    unit: { color: theme.colors.textMuted, fontSize: 11, marginBottom: 4 },
    coverage: { color: theme.colors.textMuted, flexShrink: 1, fontSize: 10, maxWidth: 105, textAlign: 'right' },
    chart: { marginTop: theme.spacing.lg },
    comparison: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: theme.spacing.md },
    footer: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: theme.spacing.xxl, textAlign: 'center' },
  });
}
