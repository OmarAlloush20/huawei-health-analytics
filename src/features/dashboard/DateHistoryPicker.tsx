import { getLocale, tr } from '../../localization/i18n';
import { Text, View, Pressable } from '../../localization/LocalizedNative';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppIcon } from '../../components/AppIcon';
import { ProductSheet } from '../../components/ProductUI';
import type { LocalDate } from '../../models/health';
import type { AppTheme } from '../../theme/theme';
import { buildCalendarMonth, moveCalendarMonth } from './dateHistory';
import { DateNavigator } from './DateNavigator';

function calendarWeekdays() { return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(getLocale(), { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + index, 12)))); }

export function DateHistoryPicker({ visible, selectedDate, today, availableDates, onClose, onSelect, theme }: {
  visible: boolean; selectedDate: LocalDate; today: LocalDate; availableDates: readonly LocalDate[];
  onClose(): void; onSelect(date: LocalDate): void; theme: AppTheme;
}) {
  const [month, setMonth] = useState(selectedDate.slice(0, 7));
  const [choosingMonth, setChoosingMonth] = useState(false);
  const available = useMemo(() => new Set(availableDates), [availableDates]);
  const months = useMemo(() => [...new Set([...availableDates.map((date) => date.slice(0, 7)), today.slice(0, 7)])].sort(), [availableDates, today]);
  const styles = createStyles(theme);
  const days = buildCalendarMonth(month);
  const label = new Intl.DateTimeFormat(getLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`));

  return <ProductSheet visible={visible} onClose={onClose} title={tr('calendar.title')} subtitle={tr('format.calendarHelp', { count: availableDates.length })} theme={theme}>
    <DateNavigator previousLabel={tr('calendar.previous')} nextLabel={tr('calendar.next')} previousDisabled={month <= months[0]} nextDisabled={month >= months.at(-1)!} onPrevious={() => setMonth(moveCalendarMonth(month, -1))} onNext={() => setMonth(moveCalendarMonth(month, 1))} theme={theme}><Pressable accessibilityRole="button" accessibilityState={{ expanded: choosingMonth }} accessibilityLabel={tr('format.chooseMonth', { date: label })} onPress={() => setChoosingMonth(!choosingMonth)} style={({ pressed }) => [styles.monthLabel, { opacity: pressed ? 0.55 : 1 }]}><Text style={styles.month}>{label} ⌄</Text></Pressable></DateNavigator>
    {choosingMonth ? <View style={styles.monthGrid}>{months.map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === month }} onPress={() => { setMonth(value); setChoosingMonth(false); }} style={({ pressed }) => [styles.monthOption, value === month && { backgroundColor: theme.colors.accentSoft }, pressed && { opacity: 0.6 }]}><Text style={styles.monthOptionText}>{new Intl.DateTimeFormat(getLocale(), { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-15T12:00:00Z`))}</Text>{value === month ? <AppIcon name="check" color={theme.colors.accent} size={14} /> : null}</Pressable>)}</View> : null}
    <View style={styles.grid}>{calendarWeekdays().map((day, index) => <Text key={index} style={styles.weekday}>{day}</Text>)}{days.map((item) => {
      const recorded = available.has(item.date), enabled = item.inMonth && (recorded || item.date === today), selected = item.date === selectedDate;
      return <Pressable key={item.date} accessibilityRole="button" accessibilityState={{ selected, disabled: !enabled }} accessibilityLabel={`${new Intl.DateTimeFormat(getLocale(), { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${item.date}T12:00:00Z`))}, ${recorded ? tr('calendar.recorded') : tr('calendar.empty')}${item.date === today ? `, ${tr('nav.today')}` : ''}`} disabled={!enabled} onPress={() => onSelect(item.date)} style={({ pressed }) => [styles.day, selected && styles.selected, item.date === today && !selected && styles.today, pressed && { backgroundColor: selected ? theme.colors.accentStrong : theme.colors.accentSoft, opacity: 0.7 }]}><Text style={[styles.dayText, !enabled && styles.muted, !item.inMonth && { color: 'transparent' }, selected && { color: theme.colors.onAccent }]}>{item.day}</Text>{recorded ? <View style={[styles.dot, selected && { backgroundColor: theme.colors.onAccent }]} /> : null}</Pressable>;
    })}</View>
    <Pressable accessibilityRole="button" onPress={() => onSelect(today)} style={({ pressed }) => [styles.todayButton, pressed && { opacity: 0.6 }]}><AppIcon name="calendar" color={theme.colors.accent} size={18} /><Text style={styles.todayText}>{tr('calendar.today')}</Text></Pressable>
  </ProductSheet>;
}

function createStyles(theme: AppTheme) { return StyleSheet.create({
  monthLabel: { flex: 1, justifyContent: 'center', minHeight: 48 }, month: { color: theme.colors.text, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, monthOption: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 12, minHeight: 48, paddingHorizontal: 12 }, monthOptionText: { color: theme.colors.text, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -12 }, weekday: { color: theme.colors.textMuted, fontSize: 10, width: '14.2857%', textAlign: 'center', marginBottom: 8 }, day: { width: '14.2857%', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, marginVertical: 2 }, selected: { backgroundColor: theme.colors.accentStrong }, today: { borderColor: theme.colors.accent, borderWidth: 1 }, dayText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' }, muted: { opacity: 0.3 }, dot: { backgroundColor: theme.colors.accent, width: 3, height: 3, borderRadius: 2, marginTop: 3 }, todayButton: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 8, minHeight: 48, marginTop: 16, paddingHorizontal: 16, borderRadius: 14, backgroundColor: theme.colors.accentSoft }, todayText: { color: theme.colors.accent, fontSize: 13, fontWeight: '600' },
}); }
