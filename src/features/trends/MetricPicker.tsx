import { tr } from '../../localization/i18n';
import { Text, View, Pressable } from '../../localization/LocalizedNative';
import { StyleSheet } from 'react-native';
import { AppIcon, type AppIconName } from '../../components/AppIcon';
import { ProductSheet } from '../../components/ProductUI';
import type { TrendMetricId } from '../../models/trends';
import type { AppTheme } from '../../theme/theme';

export interface MetricPickerOption { id: TrendMetricId; label: string; shortLabel?: string; icon: AppIconName }
export function MetricPicker({ open, options, value, onChange, onOpenChange, theme, comparison = false, disabled = false }: {
  open: boolean; options: readonly MetricPickerOption[]; value: TrendMetricId; onChange: (value: TrendMetricId) => void;
  onOpenChange: (open: boolean) => void; theme: AppTheme; comparison?: boolean; disabled?: boolean;
}) {
  const selected = options.find((option) => option.id === value) ?? options[0];
  if (!selected) return null;
  const color = comparison ? theme.colors.chartSecondary : theme.colors.accent;
  return <>
    <Pressable disabled={disabled} accessibilityHint={tr('trends.openPicker')} accessibilityLabel={`${comparison ? tr('trends.compareWith') : tr('trends.measurement')}, ${selected.label}`} accessibilityRole="button" accessibilityState={{ expanded: open, disabled }} onPress={() => onOpenChange(true)}
      style={({ pressed }) => [styles.trigger, { backgroundColor: theme.colors.surfaceRaised, opacity: disabled ? 0.55 : pressed ? 0.72 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }]}>
      <View style={[styles.metricMarker, { backgroundColor: comparison ? theme.colors.surfaceMuted : theme.colors.accentSoft }]}><AppIcon color={color} name={selected.icon} size={21} /></View>
      <View style={styles.copy}>{comparison ? <Text style={[styles.caption, { color: theme.colors.textMuted }]}>{tr('trends.compareWith')}</Text> : null}<Text style={[styles.label, { color: theme.colors.text }]}>{selected.shortLabel ?? selected.label}</Text></View>
      <Text style={[styles.chevron, { color }]}>{'⌄'}</Text>
    </Pressable>
    <ProductSheet visible={open} title={comparison ? tr('trends.comparePicker') : tr('trends.choose')} subtitle={comparison ? tr('trends.scaleHelp') : undefined} onClose={() => onOpenChange(false)} theme={theme}>
      {options.map((option) => <Pressable key={option.id} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: option.id === value }} onPress={() => { onChange(option.id); onOpenChange(false); }}
        style={({ pressed }) => [styles.option, { backgroundColor: option.id === value ? theme.colors.accentSoft : pressed ? theme.colors.surfaceRaised : 'transparent', opacity: pressed ? 0.72 : 1 }]}>
        <View style={[styles.metricMarker, { backgroundColor: theme.colors.surfaceMuted }]}><AppIcon color={option.id === value ? color : theme.colors.textSecondary} name={option.icon} size={22} /></View>
        <View style={styles.copy}><Text style={[styles.optionLabel, { color: theme.colors.text }]}>{option.shortLabel ?? option.label}</Text>{option.shortLabel && option.shortLabel !== option.label ? <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>{option.label}</Text> : null}</View>
        {option.id === value ? <View style={[styles.check, { backgroundColor: theme.colors.accentStrong }]}><AppIcon name="check" size={16} color={theme.colors.onAccent} /></View> : null}
      </Pressable>)}
    </ProductSheet>
  </>;
}
const styles = StyleSheet.create({
  trigger: { alignItems: 'center', borderRadius: 17, flexDirection: 'row', gap: 10, minHeight: 64, paddingHorizontal: 12, paddingVertical: 10 },
  metricMarker: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', width: 36, height: 36, flexShrink: 0 },
  copy: { flex: 1, minWidth: 0 }, caption: { fontSize: 10, fontWeight: '600', marginBottom: 3 }, label: { fontSize: 17, fontWeight: '700' }, chevron: { fontSize: 20 },
  option: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 66, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14, marginBottom: 6 },
  optionLabel: { fontSize: 16, fontWeight: '600' }, optionDescription: { fontSize: 12, lineHeight: 18, marginTop: 3 }, check: { alignItems: 'center', justifyContent: 'center', borderRadius: 14, height: 26, width: 26 },
});
