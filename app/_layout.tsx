import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import { STRIPE_PUBLISHABLE_KEY } from '@/constants/config';

// Hold the native splash until the bootstrap resolves the session, so the login
// screen never flashes before we know whether a token exists (see RootNavigator).
SplashScreen.preventAutoHideAsync();

GoogleSignin.configure({
  webClientId: '676995776728-cj85r0hoia2rmtcllodmiqci0nbs3bkc.apps.googleusercontent.com',
});

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const { session, isReady } = useAuth();

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  // Keep the native splash up until the persisted session has been read.
  if (!isReady) return null;

  const isSignedIn = session != null;

  return (
    <Stack>
      {/* Authenticated experiences — gated on a present (not yet validated) token. */}
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)"           options={{ headerShown: false }} />
        <Stack.Screen name="session-expired"  options={{ headerShown: false }} />
        <Stack.Screen name="video-prejoin"    options={{ headerShown: false }} />
        <Stack.Screen name="video-room"       options={{ headerShown: false }} />
        <Stack.Screen name="review"           options={{ headerShown: false }} />
        <Stack.Screen name="add-to-calendar"  options={{ headerShown: false, presentation: 'modal' }} />
      </Stack.Protected>

      {/* Sign-in. Flipping the guard re-routes automatically on sign-in/out. */}
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <AuthProvider>
        <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} urlScheme="gustavoai">
          <RootNavigator />
        </StripeProvider>
      </AuthProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
