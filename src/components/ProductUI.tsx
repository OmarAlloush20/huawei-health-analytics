import { tr } from '../localization/i18n';
import { Text, View, Pressable } from '../localization/LocalizedNative';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Modal, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { AppTheme } from '../theme/theme';
import { AppIcon, type AppIconName } from './AppIcon';
import { BottomSafeArea } from './BottomSafeArea';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); }).catch(() => { /* Remain motion-free if the platform cannot report this preference. */ });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}

export function Reveal({ children, identity }: { children: ReactNode; identity?: string }) {
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) { opacity.setValue(1); return; }
    opacity.setValue(0.7);
    const animation = Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [identity, opacity, reduced]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

export function ProductSheet({ visible, title, subtitle, onClose, theme, children }: { visible: boolean; title: string; subtitle?: string; onClose(): void; theme: AppTheme; children: ReactNode }) {
  const reduced = useReducedMotion();
  const styles = sheetStyles(theme);
  return <Modal animationType={reduced ? 'none' : 'slide'} onRequestClose={onClose} transparent statusBarTranslucent navigationBarTranslucent visible={visible}>
    <SafeAreaProvider>
    <View style={styles.backdrop}>
      <Pressable accessibilityLabel={tr('common.close')} accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill} />
      <BottomSafeArea accessibilityViewIsModal testID="product-sheet-safe-area" style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.heading}><View style={styles.headingCopy}><Text accessibilityRole="header" style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View><Pressable accessibilityLabel={tr('format.closeSheet', { name: title })} accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.close, { opacity: pressed ? 0.6 : 1 }]}><Text style={styles.closeText}>×</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </BottomSafeArea>
    </View>
    </SafeAreaProvider>
  </Modal>;
}

export function SectionLabel({ title, action, onAction, theme, compact = false }: { title: string; action?: string; onAction?: () => void; theme: AppTheme; compact?: boolean }) {
  return <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', columnGap: theme.spacing.md, rowGap: 4, justifyContent: 'space-between', minHeight: compact ? 32 : 44, marginBottom: 8 }}><Text accessibilityRole="header" style={{ color: compact ? theme.colors.textMuted : theme.colors.text, flexGrow: 1, flexShrink: 1, minWidth: 120, fontSize: compact ? 11 : 19, fontWeight: '600', letterSpacing: compact ? 0.2 : -0.3 }}>{title}</Text>{action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => ({ alignItems: 'center', flexDirection: 'row', gap: 4, justifyContent: 'center', minHeight: 48, minWidth: 48, maxWidth: '100%', opacity: pressed ? 0.55 : 1 })}><Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '600', flexShrink: 1 }}>{action}</Text><AppIcon name="arrow-right" color={theme.colors.accent} size={13} /></Pressable> : null}</View>;
}

export function CompactState({ title, message, icon = 'insights', loading = false, action, onAction, theme }: { title: string; message?: string; icon?: AppIconName; loading?: boolean; action?: string; onAction?: () => void; theme: AppTheme }) {
  return <View accessibilityLiveRegion="polite" accessibilityState={{ busy: loading }} style={{ flexDirection: 'row', gap: 12, paddingVertical: 20 }}><View style={{ alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', backgroundColor: theme.colors.surfaceMuted, borderRadius: 14, height: 42, width: 42 }}>{loading ? <ActivityIndicator color={theme.colors.accent} /> : <AppIcon color={icon === 'alert' ? theme.colors.warning : theme.colors.textSecondary} name={icon} size={21} />}</View><View style={{ flex: 1, minWidth: 0 }}><Text accessibilityRole="header" style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>{message ? <Text style={{ color: theme.colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 5 }}>{message}</Text> : null}{action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => ({ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 48, opacity: pressed ? 0.6 : 1 })}><Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '600' }}>{action} ›</Text></Pressable> : null}</View></View>;
}

function sheetStyles(theme: AppTheme) { return StyleSheet.create({
  backdrop: { backgroundColor: theme.colors.overlay, flex: 1, justifyContent: 'flex-end' },
  sheet: { alignSelf: 'center', backgroundColor: theme.colors.surfaceRaised, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', maxWidth: 720, paddingHorizontal: theme.spacing.xl, width: '100%' },
  handle: { alignSelf: 'center', backgroundColor: theme.colors.textMuted, opacity: 0.45, borderRadius: 3, height: 4, marginBottom: 18, marginTop: 10, width: 30 },
  heading: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, paddingBottom: 18, borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  headingCopy: { flex: 1, minWidth: 0 }, title: { color: theme.colors.text, fontSize: 26, fontWeight: '600', letterSpacing: -0.7 },
  subtitle: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
  close: { alignItems: 'center', backgroundColor: theme.colors.surfaceMuted, borderRadius: 16, justifyContent: 'center', minHeight: 48, minWidth: 48, flexShrink: 0 },
  closeText: { color: theme.colors.textSecondary, fontSize: 25 }, body: { paddingTop: 8, paddingBottom: 24 },
}); }
