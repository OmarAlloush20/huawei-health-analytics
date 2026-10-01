import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { Text, useColorScheme, type ColorValue } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createTheme } from '../theme/theme';
import { configureForegroundNotificationPresentation } from '../notifications/ExpoNotificationAdapter';
import { useNotificationRouting } from '../notifications/useNotificationRouting';

configureForegroundNotificationPresentation();

const tabIcon = (label: string, color: ColorValue) => <Text style={{ color, fontSize: 13, fontWeight: '800' }}>{label}</Text>;

export default function RootLayout() {
  useNotificationRouting();
  const systemScheme = useColorScheme();
  const theme = useMemo(() => createTheme(systemScheme !== 'light'), [systemScheme]);
  return (
    <SafeAreaProvider>
      <Tabs screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border, height: 68, paddingBottom: 8, paddingTop: 7 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}>
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => tabIcon('H', color) }} />
        <Tabs.Screen name="trends" options={{ title: 'Trends', tabBarIcon: ({ color }) => tabIcon('T', color) }} />
        <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: ({ color }) => tabIcon('I', color) }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => tabIcon('S', color) }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
