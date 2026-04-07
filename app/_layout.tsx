import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary';

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            contentStyle: {
              backgroundColor: '#f3efe4',
            },
          }}
        />
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
