import type { ReactNode } from 'react';
import { StyleSheet, Text as NativeText } from 'react-native';
import { Pressable, View } from '../../localization/LocalizedNative';
import { useLocale } from '../../localization/useLocale';
import type { AppTheme } from '../../theme/theme';
import { getDateNavigation } from './dateHistory';

export function DateNavigator({ previousLabel, nextLabel, previousDisabled, nextDisabled, onPrevious, onNext, theme, children }: {
  previousLabel: string; nextLabel: string; previousDisabled?: boolean; nextDisabled?: boolean;
  onPrevious(): void; onNext(): void; theme: AppTheme; children: ReactNode;
}) {
  const { language } = useLocale();
  const navigation = getDateNavigation(language);
  return <View testID="date-navigation" style={[styles.row, { direction: navigation.direction }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={previousLabel} accessibilityState={{ disabled: previousDisabled }} disabled={previousDisabled} onPress={onPrevious} style={({ pressed }) => [styles.arrow, { backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent', opacity: previousDisabled ? 0.25 : pressed ? 0.7 : 1 }]}>
      <NativeText style={{ color: theme.colors.textSecondary, fontSize: 24 }}>{navigation.previous.glyph}</NativeText>
    </Pressable>
    <View style={styles.center}>{children}</View>
    <Pressable accessibilityRole="button" accessibilityLabel={nextLabel} accessibilityState={{ disabled: nextDisabled }} disabled={nextDisabled} onPress={onNext} style={({ pressed }) => [styles.arrow, { backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent', opacity: nextDisabled ? 0.25 : pressed ? 0.7 : 1 }]}>
      <NativeText style={{ color: theme.colors.textSecondary, fontSize: 24 }}>{navigation.next.glyph}</NativeText>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, marginVertical: 8 }, arrow: { alignItems: 'center', justifyContent: 'center', minHeight: 48, width: 48, borderRadius: 14, flexShrink: 0 }, center: { flex: 1, minWidth: 0 } });
