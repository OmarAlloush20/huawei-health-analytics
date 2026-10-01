import { HomeDashboard } from './src/features/dashboard/HomeDashboard';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <HomeDashboard />
    </SafeAreaProvider>
  );
}
