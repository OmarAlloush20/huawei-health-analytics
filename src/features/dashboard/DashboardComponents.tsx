import { tr } from '../../localization/i18n';
import { Text, View, Pressable } from '../../localization/LocalizedNative';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import type { MetricAvailability, MetricDisplay } from './dashboardViewModel';
import type { AppTheme } from '../../theme/theme';
import { AppIcon, BrandMark, IconBadge, type AppIconName } from '../../components/AppIcon';

export function MetricCard({ label, metric, icon, theme }: { label: string; metric: MetricDisplay; icon: AppIconName; theme: AppTheme }) {
  const styles = createStyles(theme);
  const availability = metric.status === 'missing'
    ? tr('common.noData')
    : metric.status === 'unsupported'
      ? tr('common.unavailable')
      : metric.status === 'query-failed'
        ? tr('state.refreshNeeded')
        : null;
  return (
    <View accessible style={styles.metricCard} accessibilityLabel={`${label}: ${metric.value}${metric.unit ? ` ${metric.unit}` : ''}`}>
      <View style={styles.metricHeader}>
        <View style={styles.metricIdentity}>
          <IconBadge background={metric.status === 'available' ? theme.colors.accentSoft : theme.colors.surfaceMuted} color={metric.status === 'available' ? theme.colors.accent : theme.colors.textMuted} name={icon} size={34} />
          <Text style={styles.metricLabel}>{label}</Text>
        </View>
        {availability ? <Text style={styles.availabilityBadge}>{availability}</Text> : null}
      </View>
      <Text style={[styles.metricValue, metric.status !== 'available' && styles.unavailableValue]}>
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
      {loading ? <View style={styles.loadingMark}><BrandMark size={58} /><ActivityIndicator color={theme.colors.accent} style={styles.loadingSpinner} /></View> : <View style={styles.stateMark}><AppIcon color={theme.colors.accent} name="insights" size={32} /></View>}
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
    section: { marginTop: theme.spacing.xxl },
    metricCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      flexBasis: 180,
      flexGrow: 1,
      minHeight: 158,
      minWidth: 170,
      padding: theme.spacing.lg,
    },
    metricHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'space-between' },
    metricIdentity: { alignItems: 'center', flex: 1, flexBasis: 105, flexDirection: 'row', gap: theme.spacing.sm, minWidth: 0 },
    metricLabel: { color: theme.colors.textSecondary, flexShrink: 1, fontSize: 12, fontWeight: '700', lineHeight: 16 },
    availabilityBadge: { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.pill, color: theme.colors.textMuted, fontSize: 9, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3 },
    metricValue: { color: theme.colors.text, fontSize: theme.typography.metric, fontWeight: '800', letterSpacing: -0.8, marginTop: theme.spacing.lg },
    unavailableValue: { color: theme.colors.textSecondary, fontSize: 17, lineHeight: 23 },
    metricUnit: { color: theme.colors.textSecondary, fontSize: theme.typography.caption, marginTop: 2 },
    metricDetail: { color: theme.colors.textMuted, fontSize: theme.typography.caption, marginTop: theme.spacing.md },
    comparison: { color: theme.colors.accent, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: theme.spacing.md },
    baselineDetail: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: theme.spacing.xs },
    availability: { color: theme.colors.textMuted, fontSize: 11, marginTop: theme.spacing.sm, textTransform: 'capitalize' },
    statePanel: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.xxl },
    stateMark: { alignItems: 'center', backgroundColor: theme.colors.accentSoft, borderRadius: 36, height: 72, justifyContent: 'center', width: 72 },
    loadingMark: { alignItems: 'center', height: 72, justifyContent: 'center', width: 72 },
    loadingSpinner: { position: 'absolute' },
    stateTitle: { color: theme.colors.text, fontSize: 22, fontWeight: '700', marginTop: theme.spacing.xl, textAlign: 'center' },
    stateMessage: { color: theme.colors.textSecondary, fontSize: theme.typography.body, lineHeight: 22, marginTop: theme.spacing.sm, maxWidth: 330, textAlign: 'center' },
    primaryButton: { backgroundColor: theme.colors.accent, borderRadius: theme.radii.pill, marginTop: theme.spacing.xl, minHeight: theme.layout.minimumTouchTarget, paddingHorizontal: theme.spacing.xl, justifyContent: 'center' },
    primaryButtonText: { color: theme.colors.onAccent, fontSize: theme.typography.body, fontWeight: '700' },
    pressed: { opacity: 0.76 },
  });
}
