import { tr } from '../../localization/i18n';
import { Text, View, Pressable } from '../../localization/LocalizedNative';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appDependencies } from '../../appDependencies';
import { AppIcon, type AppIconName } from '../../components/AppIcon';
import { CompactState, SectionLabel } from '../../components/ProductUI';
import type { StoredHealthStats } from '../../database/types';
import type { DevelopmentScenarioId, DevelopmentScenarioState } from '../../services/DashboardDataService';
import { getResponsiveLayout } from '../../theme/responsive';
import type { AppTheme } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

function getDescriptions(): Record<DevelopmentScenarioId, string> { return {
  balanced: tr('dev.balancedHelp'),
  'poor-sleep': tr('dev.sleepHelp'),
  'low-hrv-elevated-rhr': tr('dev.hrvHelp'),
  'high-activity': tr('dev.activityHelp'),
  'insufficient-history': tr('dev.historyHelp'),
  'missing-data': tr('dev.missingHelp'),
}; }

const scenarioIcons: Record<DevelopmentScenarioId, AppIconName> = {
  balanced: 'recovery', 'poor-sleep': 'sleep', 'low-hrv-elevated-rhr': 'hrv', 'high-activity': 'activity', 'insufficient-history': 'clock', 'missing-data': 'alert',
};

export function DeveloperToolsScreen() {
  const { theme } = useAppTheme();
  const { width, fontScale } = useWindowDimensions();
  const { compact } = getResponsiveLayout(width, fontScale);
  const styles = useMemo(() => createStyles(theme, compact), [compact, theme]);
  const descriptions = getDescriptions();
  const [scenarios, setScenarios] = useState<DevelopmentScenarioState | null>(null);
  const [stats, setStats] = useState<StoredHealthStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);
  const mutation = useRef(false);

  const load = useCallback(async () => {
    if (mutation.current) return;
    const id = ++request.current;
    setLoading(true);
    try {
      const { dashboardService } = await appDependencies.getPersistence();
      const nextStats = await dashboardService.getStats();
      if (id !== request.current) return;
      setScenarios(dashboardService.getDevelopmentScenarios());
      setStats(nextStats);
      setError('');
    } catch {
      if (id === request.current) setError(tr('error.devLoad'));
    } finally { if (id === request.current) setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); return () => { request.current += 1; }; }, [load]));

  const chooseScenario = useCallback(async (scenario: DevelopmentScenarioId) => {
    if (mutation.current) return;
    mutation.current = true;
    request.current += 1;
    setBusy(true);
    setError('');
    try {
      const { dashboardService } = await appDependencies.getPersistence();
      const nextStats = await dashboardService.selectDevelopmentScenario(scenario);
      setStats(nextStats);
      setScenarios(dashboardService.getDevelopmentScenarios());
    } catch {
      setError(tr('error.devScenario'));
    } finally { mutation.current = false; setBusy(false); setLoading(false); }
  }, []);

  // This route hides the tab bar, so it owns all system window insets.
  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
    <StatusBar style={theme.dark ? 'light' : 'dark'} />
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Text style={styles.backText}>{tr('dev.back')}</Text></Pressable>
      <View style={styles.buildBadge}><AppIcon name="code" color={theme.colors.accent} size={15} /><Text style={styles.eyebrow}>{tr('dev.buildLabel')}</Text></View>
      <Text accessibilityRole="header" style={styles.title}>{tr('dev.tools')}</Text>
      <Text style={styles.subtitle}>{tr('dev.help')}</Text>
      {error ? <CompactState icon="alert" title={tr('dev.failed')} message={error} action={tr('common.retry')} onAction={() => void load()} theme={theme} /> : null}
      {loading ? <CompactState loading title={tr('dev.loading')} theme={theme} /> : null}
      {!loading && !error && !scenarios ? <CompactState icon="settings" title={tr('dev.unavailable')} message={tr('dev.requires')} theme={theme} /> : null}
      {scenarios ? <View style={styles.section}>
        <View style={styles.status}><Text style={styles.statusValue}>{tr('format.recorded', { count: stats?.storedDays ?? 0 })}</Text>{busy ? <ActivityIndicator color={theme.colors.accent} size="small" accessibilityLabel={tr('dev.updating')} /> : <Text style={styles.local}>{tr('dev.local')}</Text>}</View>
        <SectionLabel compact title={tr('dev.scenarios')} theme={theme} />
        {scenarios.options.map((option) => {
          const selected = option.id === scenarios.current;
          return <Pressable accessibilityLabel={`${option.label}. ${descriptions[option.id]}`} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: busy || loading }} disabled={busy || loading} key={option.id} onPress={() => void chooseScenario(option.id)} style={({ pressed }) => [styles.scenario, selected && styles.scenarioSelected, pressed && styles.pressed]}>
            <View style={[styles.scenarioIcon, selected && styles.selectedIcon]}><AppIcon name={scenarioIcons[option.id]} color={selected ? theme.colors.accent : theme.colors.textMuted} size={20} /></View>
            <View style={styles.scenarioCopy}><Text style={[styles.scenarioLabel, selected && styles.selectedLabel]}>{option.label}</Text>{selected ? <Text style={styles.scenarioDescription}>{descriptions[option.id]}</Text> : null}</View>
            <View style={styles.selection}>{selected ? <View style={styles.selectedDot}><AppIcon name="check" color={theme.colors.onAccent} size={13} /></View> : <View style={styles.selectionDot} />}</View>
          </Pressable>;
        })}
      </View> : null}
    </ScrollView>
  </SafeAreaView>;
}

function createStyles(theme: AppTheme, compact: boolean) {
  return StyleSheet.create({
    safeArea: { backgroundColor: theme.colors.background, flex: 1 },
    content: { alignSelf: 'center', maxWidth: theme.layout.contentMaxWidth, paddingBottom: 28, paddingHorizontal: compact ? 16 : 24, width: '100%' },
    back: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 48, paddingEnd: 16 },
    backText: { color: theme.colors.accent, fontSize: 15, fontWeight: '600' },
    buildBadge: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: theme.colors.surfaceMuted, borderRadius: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingHorizontal: 9, paddingVertical: 6 },
    eyebrow: { color: theme.colors.accent, fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
    title: { color: theme.colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.8, marginTop: 12 },
    subtitle: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 8 },
    section: { marginTop: 24 },
    status: { alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', marginBottom: 20, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10 },
    statusValue: { color: theme.colors.textSecondary, fontSize: 12 },
    local: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
    scenario: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 10, marginBottom: 4, minHeight: 58, paddingHorizontal: 10, paddingVertical: 10 },
    scenarioSelected: { backgroundColor: theme.colors.surfaceRaised },
    scenarioIcon: { alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 11, flexShrink: 0, height: 36, justifyContent: 'center', width: 36 },
    selectedIcon: { backgroundColor: theme.colors.accentSoft },
    scenarioCopy: { flex: 1, minWidth: 0 },
    scenarioLabel: { color: theme.colors.text, fontSize: 14, fontWeight: '500', lineHeight: 21 },
    selectedLabel: { color: theme.colors.accent },
    scenarioDescription: { color: theme.colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 4 },
    selection: { alignItems: 'center', flexShrink: 0, justifyContent: 'center', width: 20 },
    selectionDot: { borderColor: theme.colors.border, borderRadius: 9, borderWidth: 1.5, height: 18, width: 18 },
    selectedDot: { alignItems: 'center', backgroundColor: theme.colors.accentStrong, borderRadius: 9, height: 18, justifyContent: 'center', width: 18 },
    pressed: { opacity: 0.65 },
  });
}
