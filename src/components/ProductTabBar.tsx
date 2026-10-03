import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Pressable, Text, View } from '../localization/LocalizedNative';
import { tr } from '../localization/i18n';
import { useAppTheme } from '../theme/ThemeContext';
import { AppIcon, type AppIconName } from './AppIcon';
import { BottomSafeArea } from './BottomSafeArea';

const destinations: Record<string, { title: 'nav.today' | 'nav.trends' | 'nav.insights' | 'nav.settings'; icon: AppIconName }> = {
  index: { title: 'nav.today', icon: 'home' }, trends: { title: 'nav.trends', icon: 'trends' },
  insights: { title: 'nav.insights', icon: 'insights' }, settings: { title: 'nav.settings', icon: 'settings' },
};

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
export function ProductTabBar({ state, navigation }: TabBarProps) {
  const { theme } = useAppTheme();
  if (!destinations[state.routes[state.index].name]) return null;
  // Normal-flow height includes the native live inset. No fixed tab height/cache.
  return <BottomSafeArea testID="product-tab-safe-area" style={[styles.navShell, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
    <View style={styles.navRow}>{state.routes.filter((route) => destinations[route.name]).map((route) => {
      const item = destinations[route.name], selected = state.routes[state.index].key === route.key;
      return <Pressable key={route.key} accessibilityLabel={tr(item.title)} accessibilityRole="tab" accessibilityState={{ selected }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })} onPress={() => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
      }} style={({ pressed }) => [styles.navItem, { opacity: pressed ? 0.6 : 1 }]}><View style={[styles.iconShell, { backgroundColor: selected ? theme.colors.accentSoft : 'transparent' }]}><AppIcon name={item.icon} color={selected ? theme.colors.accent : theme.colors.textMuted} size={21} strokeWidth={selected ? 2 : 1.7} /><View style={[styles.selectionMark, { backgroundColor: selected ? theme.colors.accent : 'transparent' }]} /></View><Text style={[styles.navLabel, { color: selected ? theme.colors.text : theme.colors.textMuted, fontWeight: selected ? '700' : '500' }]}>{tr(item.title)}</Text></Pressable>;
    })}</View>
  </BottomSafeArea>;
}

const styles = StyleSheet.create({ navShell: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 }, navRow: { alignSelf: 'center', flexDirection: 'row', maxWidth: 720, width: '100%', gap: 4 }, navItem: { alignItems: 'center', flex: 1, gap: 4, justifyContent: 'center', minHeight: 54, paddingVertical: 2 }, navLabel: { fontSize: 10, textAlign: 'center' }, iconShell: { alignItems: 'center', borderRadius: 13, height: 32, justifyContent: 'center', width: 48 }, selectionMark: { height: 2, width: 12, borderRadius: 2, position: 'absolute', bottom: 3 } });
