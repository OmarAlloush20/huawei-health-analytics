import { tr } from '../localization/i18n';
import { Tabs } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppThemeProvider, useAppTheme } from '../theme/ThemeContext';
import { configureForegroundNotificationPresentation } from '../notifications/ExpoNotificationAdapter';
import { useNotificationRouting } from '../notifications/useNotificationRouting';
import { ProductTabBar } from '../components/ProductTabBar';
import { LanguageProvider } from '../localization/LanguageContext';

configureForegroundNotificationPresentation();

export default function RootLayout() {
  useNotificationRouting();
  return (
    <SafeAreaProvider>
      <LanguageProvider><AppThemeProvider><ThemedTabs /></AppThemeProvider></LanguageProvider>
    </SafeAreaProvider>
  );
}
function ThemedTabs() {
  const { theme } = useAppTheme();
  return (
      <Tabs tabBar={(props) => <ProductTabBar {...props} />} screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarItemStyle: { minHeight: theme.layout.minimumTouchTarget },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.1 },
      }}>
        <Tabs.Screen name="index" options={{ title: tr('nav.today') }} />
        <Tabs.Screen name="trends" options={{ title: tr('nav.trends') }} />
        <Tabs.Screen name="insights" options={{ title: tr('nav.insights') }} />
        <Tabs.Screen name="settings" options={{ title: tr('nav.settings') }} />
        <Tabs.Screen name="metric/[metric]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="developer-tools" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      </Tabs>
  );
}
