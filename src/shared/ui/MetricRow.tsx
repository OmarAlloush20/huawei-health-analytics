import { StyleSheet, Text, View } from 'react-native';

interface MetricRowProps {
  label: string;
  value: string;
}

export function MetricRow({ label, value }: MetricRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomColor: '#e4e9e6',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    color: '#5f6d66',
    fontSize: 16,
  },
  value: {
    color: '#17221d',
    fontSize: 16,
    fontWeight: '600',
  },
});
