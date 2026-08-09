import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { DialogHost } from '@/components/ui/dialog';
import { ToastHost } from '@/components/ui/toast';
import { Colors } from '@/constants/theme';
import { BookingsProvider } from '@/store/bookings';
import { NotificationsProvider } from '@/store/notifications';
import { SessionProvider } from '@/store/session';

SplashScreen.preventAutoHideAsync();

/** The app is pinned to light — see hooks/use-theme.ts. */
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.light.background,
    card: Colors.light.surface,
    border: Colors.light.border,
    text: Colors.light.text,
    primary: Colors.light.primary,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Hold the splash until the type is ready, so nothing renders in the fallback
  // face and then reflows. A font error still releases it — shipping the
  // system font beats a permanently stuck splash screen.
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: Colors.light.background }} />;
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="dark" />
      <AnimatedSplashOverlay />
      {/* Session first: the bookings store stamps ownership from it. */}
      <SessionProvider>
        <NotificationsProvider>
          <BookingsProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.light.background },
              }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="rate-calculator"
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="corporate"
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
            </Stack>
            {/* Outside the Stack so these survive navigation. */}
            <DialogHost />
            <ToastHost />
          </BookingsProvider>
        </NotificationsProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
