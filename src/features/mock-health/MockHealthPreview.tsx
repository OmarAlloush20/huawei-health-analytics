import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appDependencies } from '../../appDependencies';
import type { DailyHealthSummary, HealthMetric, NormalizedHealthData } from '../../models/health';
import type { StoredHealthStats } from '../../database/types';
import { resetAndReseedDevelopmentDatabase } from '../../database/developmentReset';
import { MockHealthProvider } from '../../providers/mock/MockHealthProvider';
import { MOCK_HEALTH_SCENARIOS, type MockHealthScenarioId } from '../../providers/mock/mockHealthData';
import { addLocalDays } from '../../shared/dates/healthDates';
import { formatNumber, formatSleepDuration } from '../../shared/formatters/healthFormatters';
import { MetricRow } from '../../shared/ui/MetricRow';

export function MockHealthPreview() {
  const mockProvider = appDependencies.healthProvider instanceof MockHealthProvider
    ? appDependencies.healthProvider
    : null;
  const initialRange = useMemo(() => mockProvider?.getAvailableRange(), [mockProvider]);
  const [scenario, setScenario] = useState<MockHealthScenarioId>(mockProvider?.getScenario() ?? 'balanced');
  const [selectedDate, setSelectedDate] = useState(initialRange?.end ?? '2026-09-30');
  const [summary, setSummary] = useState<DailyHealthSummary | null>(null);
  const [healthData, setHealthData] = useState<NormalizedHealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storedSummary, setStoredSummary] = useState<DailyHealthSummary | null>(null);
  const [stats, setStats] = useState<StoredHealthStats | null>(null);
  const [persistenceMessage, setPersistenceMessage] = useState('Not imported');
  const [persistenceBusy, setPersistenceBusy] = useState(false);
  const range = mockProvider?.getAvailableRange();

  useEffect(() => {
    let active = true;
    const timeZone = mockProvider?.getAvailableRange().timeZone
      ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    appDependencies.healthProvider
      .getHealthData({ start: selectedDate, end: selectedDate, timeZone })
      .then((result) => {
        if (!active) return;
        setError(null);
        setHealthData(result);
        setSummary(result.dailySummaries.status === 'available'
          ? result.dailySummaries.value[0] ?? null
          : null);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load health data.');
      });
    return () => { active = false; };
  }, [mockProvider, scenario, selectedDate]);

  useEffect(() => {
    let active = true;
    appDependencies.getPersistence().then(async ({ repository, syncService }) => {
      const [nextStats, nextSummary] = await Promise.all([
        syncService.getStats(),
        repository.getDailySummary(appDependencies.healthProvider.id, {
          date: selectedDate,
          timeZone: range?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      ]);
      if (active) {
        setStats(nextStats);
        setStoredSummary(nextSummary);
      }
    }).catch((reason: unknown) => {
      if (active) setPersistenceMessage(reason instanceof Error ? reason.message : 'Database unavailable');
    });
    return () => { active = false; };
  }, [range?.timeZone, scenario, selectedDate]);

  async function refreshPersistence() {
    const { repository, syncService } = await appDependencies.getPersistence();
    setStats(await syncService.getStats());
    setStoredSummary(await repository.getDailySummary(appDependencies.healthProvider.id, {
      date: selectedDate,
      timeZone: range?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    }));
  }

  async function runPersistenceAction(action: () => Promise<unknown>, successMessage: string) {
    setPersistenceBusy(true);
    try {
      await action();
      await refreshPersistence();
      setPersistenceMessage(successMessage);
    } catch (reason) {
      setPersistenceMessage(reason instanceof Error ? reason.message : 'Persistence action failed');
    } finally {
      setPersistenceBusy(false);
    }
  }

  function chooseScenario(nextScenario: MockHealthScenarioId) {
    if (!mockProvider) return;
    mockProvider.setScenario(nextScenario);
    setSummary(null);
    setHealthData(null);
    setScenario(nextScenario);
    setSelectedDate(mockProvider.getAvailableRange().end);
  }

  function shiftDate(amount: number) {
    if (!range) return;
    const next = addLocalDays(selectedDate, amount);
    if (next >= range.start && next <= range.end) {
      setSummary(null);
      setHealthData(null);
      setSelectedDate(next);
    }
  }

  if (error) return <Text style={styles.message}>Health provider error: {error}</Text>;
  if (!summary) return <ActivityIndicator style={styles.loader} color="#176b45" size="large" />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>MILESTONE 3 · {appDependencies.healthProvider.id.toUpperCase()} PROVIDER</Text>
      <Text style={styles.title}>Persistence inspector</Text>
      <Text style={styles.subtitle}>Deterministic normalized data supplied by {appDependencies.healthProvider.displayName}.</Text>

      {mockProvider ? (
        <>
          <Text style={styles.sectionLabel}>SCENARIO</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scenarioList}>
            {MOCK_HEALTH_SCENARIOS.map((item) => (
              <Pressable key={item.id} onPress={() => chooseScenario(item.id)} style={[styles.scenarioButton, scenario === item.id && styles.scenarioButtonSelected]}>
                <Text style={[styles.scenarioText, scenario === item.id && styles.scenarioTextSelected]}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.scenarioDescription}>{MOCK_HEALTH_SCENARIOS.find((item) => item.id === scenario)?.description}</Text>
          <View style={styles.dateControls}>
            <Pressable accessibilityLabel="Previous day" onPress={() => shiftDate(-1)} disabled={selectedDate === range?.start} style={styles.dateButton}><Text>‹</Text></Pressable>
            <Text style={styles.date}>{selectedDate}</Text>
            <Pressable accessibilityLabel="Next day" onPress={() => shiftDate(1)} disabled={selectedDate === range?.end} style={styles.dateButton}><Text>›</Text></Pressable>
          </View>
        </>
      ) : null}

      <View style={styles.card}>
        <MetricRow label="Steps" value={metricText(summary.activity, (value) => formatNumber(value.steps))} />
        <MetricRow label="Resting heart rate" value={metricText(summary.heartRate, (value) => value.restingBpm === undefined ? 'not reported' : `${value.restingBpm} bpm`)} />
        <MetricRow label="HRV (RMSSD)" value={metricText(summary.hrv, (value) => `${value.averageRmssdMs} ms`)} />
        <MetricRow label="SpO₂" value={metricText(summary.oxygenSaturation, (value) => `${value.averagePercent}%`)} />
        <MetricRow label="Sleep" value={metricText(summary.sleep, (value) => formatSleepDuration(value.totalSleepMinutes))} />
        <MetricRow label="Activity load" value={metricText(summary.activityLoad, () => 'available')} />
      </View>

      {mockProvider && range ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>LOCAL SQLITE</Text>
          <MetricRow label="Schema version" value={String(stats?.schemaVersion ?? 'loading')} />
          <MetricRow label="Stored days" value={String(stats?.storedDays ?? 0)} />
          <MetricRow label="Stored range" value={stats?.firstDate ? `${stats.firstDate} → ${stats.lastDate}` : 'empty'} />
          <MetricRow label="Last sync" value={stats?.sync?.status ?? 'never'} />
          <MetricRow label="Selected day persisted" value={storedSummary ? 'yes' : 'no'} />
          <Text style={styles.persistenceMessage}>{persistenceMessage}</Text>
          <View style={styles.actionRow}>
            <Pressable disabled={persistenceBusy} style={styles.actionButton} onPress={() => runPersistenceAction(async () => {
              const { syncService } = await appDependencies.getPersistence();
              await syncService.sync(range);
            }, 'Scenario imported idempotently.')}><Text style={styles.actionText}>Import scenario</Text></Pressable>
            <Pressable disabled={persistenceBusy} style={styles.actionButton} onPress={() => runPersistenceAction(async () => {
              const { syncService } = await appDependencies.getPersistence();
              await syncService.deleteDetailedData();
            }, 'Detailed local data deleted; daily summaries retained.')}><Text style={styles.actionText}>Delete details</Text></Pressable>
          </View>
          <View style={styles.actionRow}>
            <Pressable disabled={persistenceBusy} style={styles.dangerButton} onPress={() => runPersistenceAction(async () => {
              const { syncService } = await appDependencies.getPersistence();
              await syncService.deleteAllLocalHealthData();
            }, 'All app-local health data deleted.')}><Text style={styles.dangerText}>Delete all local</Text></Pressable>
            {__DEV__ ? <Pressable disabled={persistenceBusy} style={styles.dangerButton} onPress={() => runPersistenceAction(async () => {
              const { database, syncService } = await appDependencies.getPersistence();
              await resetAndReseedDevelopmentDatabase(database, syncService, range);
            }, 'Development database reset, migrated, and reseeded.')}><Text style={styles.dangerText}>DEV reset + seed</Text></Pressable> : null}
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>COMPLETENESS & DETAIL</Text>
        <MetricRow label="Available" value={summary.completeness.available.join(', ') || 'none'} />
        <MetricRow label="Missing" value={summary.completeness.missing.join(', ') || 'none'} />
        <MetricRow label="Unsupported" value={summary.completeness.unsupported.join(', ') || 'none'} />
        <MetricRow label="Query failed" value={summary.completeness.queryFailed.join(', ') || 'none'} />
        <MetricRow label="Sleep sessions" value={collectionCount(healthData?.sleepSessions)} />
        <MetricRow label="Heart samples" value={collectionCount(healthData?.heartRateSamples)} />
        <MetricRow label="HRV observations" value={collectionCount(healthData?.hrvObservations)} />
        <MetricRow label="SpO₂ samples" value={collectionCount(healthData?.oxygenSaturationSamples)} />
        <MetricRow label="Workouts" value={collectionCount(healthData?.workouts)} />
      </View>

      <Text style={styles.note}>Developer viewer only. Destructive controls affect this app&apos;s local SQLite data, never Huawei Health. Recovery scoring, trends, insights, and the product dashboard remain deferred.</Text>
    </ScrollView>
  );
}

function metricText<T>(metric: HealthMetric<T>, formatter: (value: T) => string): string {
  return metric.status === 'available' ? formatter(metric.value) : metric.status;
}

function collectionCount<T>(metric: HealthMetric<T[]> | undefined): string {
  return metric?.status === 'available' ? String(metric.value.length) : metric?.status ?? 'loading';
}

const styles = StyleSheet.create({
  loader: { flex: 1 },
  message: { margin: 24, color: '#a12c2c' },
  content: { padding: 24, paddingBottom: 54, paddingTop: 54 },
  eyebrow: { color: '#176b45', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#17221d', fontSize: 30, fontWeight: '700', marginTop: 10 },
  subtitle: { color: '#5f6d66', fontSize: 16, lineHeight: 23, marginTop: 8 },
  sectionLabel: { color: '#176b45', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 24 },
  scenarioList: { gap: 8, paddingVertical: 10 },
  scenarioButton: { backgroundColor: '#e3ebe7', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  scenarioButtonSelected: { backgroundColor: '#176b45' },
  scenarioText: { color: '#405149', fontSize: 13, fontWeight: '600' },
  scenarioTextSelected: { color: '#ffffff' },
  scenarioDescription: { color: '#5f6d66', fontSize: 13, lineHeight: 19 },
  dateControls: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  dateButton: { alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  date: { color: '#176b45', fontSize: 14, fontWeight: '600', paddingHorizontal: 18 },
  card: { backgroundColor: '#ffffff', borderRadius: 18, marginTop: 18, paddingHorizontal: 20, paddingVertical: 8 },
  cardLabel: { color: '#176b45', fontSize: 12, fontWeight: '700', letterSpacing: 1, paddingBottom: 5, paddingTop: 10 },
  note: { color: '#77837d', fontSize: 13, lineHeight: 19, marginTop: 20 },
  persistenceMessage: { color: '#5f6d66', fontSize: 12, marginVertical: 10 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  actionButton: { backgroundColor: '#176b45', borderRadius: 10, flex: 1, padding: 10 },
  actionText: { color: '#ffffff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  dangerButton: { borderColor: '#a12c2c', borderRadius: 10, borderWidth: 1, flex: 1, padding: 10 },
  dangerText: { color: '#a12c2c', fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
