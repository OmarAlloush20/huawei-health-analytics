import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TrendRangeId } from '../../models/trends';
import type { AppTheme } from '../../theme/theme';

const options: readonly { id: TrendRangeId; label: string }[] = [{ id: '7d', label: '7D' }, { id: '30d', label: '30D' }, { id: '90d', label: '90D' }];

export function RangeSelector({ value, onChange, theme }: { value: TrendRangeId; onChange: (value: TrendRangeId) => void; theme: AppTheme }) {
  const styles = createStyles(theme);
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {options.map((option) => (
        <Pressable key={option.id} accessibilityRole="tab" accessibilityState={{ selected: value === option.id }} onPress={() => onChange(option.id)} style={({ pressed }) => [styles.option, value === option.id && styles.selected, pressed && styles.pressed]}>
          <Text style={[styles.label, value === option.id && styles.selectedLabel]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.pill, flexDirection: 'row', padding: 4 },
    option: { alignItems: 'center', borderRadius: theme.radii.pill, flex: 1, justifyContent: 'center', minHeight: 40 },
    selected: { backgroundColor: theme.colors.surface },
    label: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '800' },
    selectedLabel: { color: theme.colors.accent },
    pressed: { opacity: 0.72 },
  });
}
