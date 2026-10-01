import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MetricAvailability, MetricDisplay } from './dashboardViewModel';
import type { AppTheme } from '../../theme/theme';

export function MetricCard({ label, metric, theme }: { label: string; metric: MetricDisplay; theme: AppTheme }) {
  const styles = createStyles(theme);
  return (
    <View style={styles.metricCard} accessibilityLabel={`${label}: ${metric.value}${metric.unit ? ` ${metric.unit}` : ''}`}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricDot, metric.status !== 'available' && styles.metricDotMuted]} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, metric.status !== 'available' && styles.unavailableValue]} numberOfLines={2} adjustsFontSizeToFit>
        {metric.value}
      </Text>
      {metric.unit ? <Text style={styles.metricUnit}>{metric.unit}</Text> : null}
      {metric.detail ? <Text style={styles.metricDetail}>{metric.detail}</Text> : null}
      {metric.comparison ? <Text style={styles.comparison}>{metric.comparison}</Text> : null}
      {metric.baselineDetail ? <Text style={styles.baselineDetail}>{metric.baselineDetail}</Text> : null}
    </View>
  );
}

export function StatePanel({ title, message, actionLabel, onAction, loading, theme }: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
  theme: AppTheme;
}) {
  const styles = createStyles(theme);
  return (
    <View style={styles.statePanel}>
      {loading ? <ActivityIndicator color={theme.colors.accent} size="large" /> : <View style={styles.stateMark}><View style={styles.stateMarkInner} /></View>}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function DashboardSection({ children, theme }: { children: ReactNode; theme: AppTheme }) {
  return <View style={createStyles(theme).section}>{children}</View>;
}

export function AvailabilityLabel({ status, theme }: { status: MetricAvailability; theme: AppTheme }) {
  if (status === 'available') return null;
  const styles = createStyles(theme);
  return <Text style={styles.availability}>{status === 'query-failed' ? 'Refresh unavailable' : status}</Text>;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: { marginTop: theme.spacing.xl },
    metricCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      flexGrow: 1,
      minHeight: 154,
      minWidth: 145,
      padding: theme.spacing.lg,
    },
    metricHeader: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm },
    metricDot: { backgroundColor: theme.colors.accent, borderRadius: 4, height: 8, width: 8 },
    metricDotMuted: { backgroundColor: theme.colors.textMuted },
    metricLabel: { color: theme.colors.textSecondary, fontSize: theme.typography.caption, fontWeight: '600' },
    metricValue: { color: theme.colors.text, fontSize: theme.typography.metric, fontWeight: '700', letterSpacing: -0.6, marginTop: theme.spacing.lg },
    unavailableValue: { color: theme.colors.textSecondary, fontSize: 17, lineHeight: 23 },
    metricUnit: { color: theme.colors.textSecondary, fontSize: theme.typography.caption, marginTop: 2 },
    metricDetail: { color: theme.colors.textMuted, fontSize: theme.typography.caption, marginTop: theme.spacing.md },
    comparison: { color: theme.colors.accent, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: theme.spacing.md },
    baselineDetail: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: theme.spacing.xs },
    availability: { color: theme.colors.textMuted, fontSize: 11, marginTop: theme.spacing.sm, textTransform: 'capitalize' },
    statePanel: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.xxl },
    stateMark: { alignItems: 'center', backgroundColor: theme.colors.accentSoft, borderRadius: 36, height: 72, justifyContent: 'center', width: 72 },
    stateMarkInner: { backgroundColor: theme.colors.accent, borderRadius: 13, height: 26, width: 26 },
    stateTitle: { color: theme.colors.text, fontSize: 22, fontWeight: '700', marginTop: theme.spacing.xl, textAlign: 'center' },
    stateMessage: { color: theme.colors.textSecondary, fontSize: theme.typography.body, lineHeight: 22, marginTop: theme.spacing.sm, maxWidth: 330, textAlign: 'center' },
    primaryButton: { backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill, marginTop: theme.spacing.xl, minHeight: 48, paddingHorizontal: theme.spacing.xl, justifyContent: 'center' },
    primaryButtonText: { color: theme.dark ? '#092116' : '#FFFFFF', fontSize: theme.typography.body, fontWeight: '700' },
    pressed: { opacity: 0.76 },
  });
}
