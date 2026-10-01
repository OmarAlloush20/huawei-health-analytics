import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appDependencies } from '../../appDependencies';
import type { InsightsResult } from '../../models/insights';
import type { TrendRangeId } from '../../models/trends';
import { getSystemTimeZone } from '../../shared/dates/healthDates';
import { createTheme, type AppTheme } from '../../theme/theme';
import { RangeSelector } from '../trends/RangeSelector';

export function InsightsScreen() {
  const scheme = useColorScheme();
  const theme = useMemo(() => createTheme(scheme !== 'light'), [scheme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [range, setRange] = useState<TrendRangeId>('7d');
  const [result, setResult] = useState<InsightsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (nextRange: TrendRangeId, refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const { dashboardService, insightsService } = await appDependencies.getPersistence();
      let stats = await dashboardService.getStats();
      stats = await dashboardService.bootstrapDevelopmentDataIfEmpty(stats);
      if (!stats.lastDate) { setResult(null); return; }
      setResult(await insightsService.getInsights(nextRange, stats.lastDate, stats.sync?.range?.timeZone ?? getSystemTimeZone()));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Insights could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(() => load(range)); }, [load, range]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(range, true)} tintColor={theme.colors.accent} colors={[theme.colors.accent]} />}>
        <Text style={styles.eyebrow}>DETERMINISTIC</Text>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>A small set of meaningful observations backed by your recorded history.</Text>
        <View style={styles.selector}><RangeSelector value={range} onChange={setRange} theme={theme} /></View>

        {loading ? <View style={styles.state}><ActivityIndicator color={theme.colors.accent} /><Text style={styles.stateText}>Checking recent patterns…</Text></View> : null}
        {error ? <View style={styles.state}><Text style={styles.stateTitle}>Insights unavailable</Text><Text style={styles.stateText}>{error}</Text></View> : null}
        {!loading && !error && result?.insights.length === 0 ? (
          <View style={styles.calmState}><Text style={styles.calmMark}>—</Text><Text style={styles.stateTitle}>No notable change</Text><Text style={styles.stateText}>No pattern crossed the conservative insight thresholds for this period.</Text></View>
        ) : null}
        {result?.insights.map((insight) => (
          <View key={insight.ruleId} style={styles.card}>
            <View style={styles.cardTop}><Text style={styles.type}>{insight.type.replaceAll('-', ' ')}</Text><Text style={styles.coverage}>{insight.evidence.availableDays}/{insight.evidence.expectedDays} days</Text></View>
            <Text style={styles.cardTitle}>{insight.title}</Text>
            <Text style={styles.explanation}>{insight.explanation}</Text>
            <Text style={styles.dates}>{insight.startDate} – {insight.endDate}</Text>
          </View>
        ))}
        <Text style={styles.footer}>Insights are descriptive wellness observations, not warnings or medical advice.</Text>
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
    calmState: { alignItems: 'center', backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, marginTop: theme.spacing.xl, padding: theme.spacing.xxl },
    calmMark: { color: theme.colors.accent, fontSize: 30, fontWeight: '300' },
    stateTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700', marginTop: theme.spacing.sm },
    stateText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: theme.spacing.sm, textAlign: 'center' },
    card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, marginTop: theme.spacing.lg, padding: theme.spacing.xl },
    cardTop: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'space-between' },
    type: { color: theme.colors.accent, flexGrow: 1, flexShrink: 1, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
    coverage: { color: theme.colors.textMuted, flexShrink: 0, fontSize: 10 },
    cardTitle: { color: theme.colors.text, fontSize: 19, fontWeight: '700', lineHeight: 25, marginTop: theme.spacing.lg },
    explanation: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: theme.spacing.sm },
    dates: { color: theme.colors.textMuted, fontSize: 10, marginTop: theme.spacing.lg },
    footer: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: theme.spacing.xxl, textAlign: 'center' },
  });
}
