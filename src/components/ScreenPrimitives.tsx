import { Text, View } from '../localization/LocalizedNative';
import { ActivityIndicator, StyleSheet } from 'react-native';

import type { AppTheme } from '../theme/theme';
import { AppIcon, BrandMark, type AppIconName } from './AppIcon';

export function ScreenHeader({ eyebrow, title, subtitle, theme }: {
  eyebrow: string;
  title: string;
  subtitle: string;
  theme: AppTheme;
}) {
  const styles = createStyles(theme);
  return (
    <View accessibilityRole="header">
      <View style={styles.eyebrowRow}><View style={styles.eyebrowMark} /><Text style={styles.eyebrow}>{eyebrow}</Text></View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

export function ScreenStateCard({ title, message, loading = false, icon = 'insights', theme }: {
  title: string;
  message: string;
  loading?: boolean;
  icon?: AppIconName;
  theme: AppTheme;
}) {
  const styles = createStyles(theme);
  return (
    <View accessibilityLiveRegion="polite" accessible accessibilityLabel={`${title}. ${message}`} style={styles.stateCard}>
      {loading ? (
        <View style={styles.loadingMark}><BrandMark size={42} /><ActivityIndicator color={theme.colors.accent} size="small" style={styles.loadingSpinner} /></View>
      ) : (
        <View style={styles.stateMark}><AppIcon color={theme.colors.accent} name={icon} size={25} /></View>
      )}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{message}</Text>
    </View>
  );
}

export function SectionHeading({ title, detail, theme }: { title: string; detail?: string; theme: AppTheme }) {
  const styles = createStyles(theme);
  return (
    <View style={styles.sectionHeading}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    eyebrow: { color: theme.colors.accent, fontSize: theme.typography.eyebrow, fontWeight: '800', letterSpacing: 1.7 },
    eyebrowRow: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm },
    eyebrowMark: { backgroundColor: theme.colors.accent, borderRadius: 3, height: 6, width: 18 },
    title: { color: theme.colors.text, fontSize: theme.typography.hero, fontWeight: '700', letterSpacing: -1.1, marginTop: theme.spacing.xs },
    subtitle: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: theme.spacing.sm, maxWidth: 420 },
    stateCard: { alignItems: 'center', backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, marginTop: theme.spacing.xl, overflow: 'hidden', paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.xxl },
    stateMark: { alignItems: 'center', backgroundColor: theme.colors.accentSoft, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
    loadingMark: { alignItems: 'center', height: 54, justifyContent: 'center', width: 54 },
    loadingSpinner: { position: 'absolute' },
    stateTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700', marginTop: theme.spacing.md, textAlign: 'center' },
    stateText: { color: theme.colors.textSecondary, fontSize: theme.typography.caption, lineHeight: 19, marginTop: theme.spacing.sm, maxWidth: 360, textAlign: 'center' },
    sectionHeading: { marginBottom: theme.spacing.md },
    sectionTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.35 },
    sectionDetail: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 16, marginTop: 3 },
  });
}
