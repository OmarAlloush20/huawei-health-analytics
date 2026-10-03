import { Text, View, Pressable } from '../../localization/LocalizedNative';
import { tr } from '../../localization/i18n';
import { StyleSheet } from 'react-native';

import type { TrendRangeId } from '../../models/trends';
import type { AppTheme } from '../../theme/theme';

const options: readonly { id: TrendRangeId; label: string }[] = [{ id: '7d', label: '7D' }, { id: '30d', label: '30D' }, { id: '90d', label: '90D' }];

export function RangeSelector({ value, onChange, theme, disabled = false }: { value: TrendRangeId; onChange: (value: TrendRangeId) => void; theme: AppTheme; disabled?: boolean }) {
  const styles = createStyles(theme);
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {options.map((option) => (
        <Pressable key={option.id} disabled={disabled} accessibilityLabel={tr('format.dayPeriod', { count: option.label.replace('D', '') })} accessibilityRole="tab" accessibilityState={{ selected: value === option.id, disabled }} onPress={() => onChange(option.id)} style={({ pressed }) => [styles.option, value === option.id && styles.selected, pressed && styles.pressed]}>
          <Text style={[styles.label, value === option.id && styles.selectedLabel]}>{tr(`range.${option.id}`)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { backgroundColor: theme.colors.surface, borderRadius: 16, flexDirection: 'row', padding: 4, gap: 4 },
    option: { alignItems: 'center', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: theme.layout.minimumTouchTarget, paddingHorizontal: 4, paddingVertical: 6 },
    selected: { backgroundColor: theme.colors.accentSoft },
    label: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', textAlign: 'center' },
    selectedLabel: { color: theme.colors.accent, fontWeight: '800' },
    pressed: { opacity: 0.72 },
  });
}
