import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { StripeProvider } from '@stripe/stripe-react-native';
import { ZoomVideoSdkProvider } from '@zoom/react-native-videosdk';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import { LocaleProvider } from '@/lib/i18n/locale-context';
import { cancelAllReminders, syncClassReminders } from '@/lib/notifications-native';
import { STRIPE_PUBLISHABLE_KEY } from '@/constants/config';

// Hold the native splash until the bootstrap resolves the session, so the login
// screen never flashes before we know whether a token exists (see RootNavigator).
SplashScreen.preventAutoHideAsync();

GoogleSignin.configure({
  webClientId: '676995776728-cj85r0hoia2rmtcllodmiqci0nbs3bkc.apps.googleusercontent.com',
});

// Show class reminders even when the app is foregrounded (the default suppresses
// them). Set once at JS load. SDK-54 fields — `shouldShowAlert` is deprecated.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Zoom Video SDK init config. Stable module-level object so the provider doesn't
// see a new reference every render. domain defaults to 'zoom.us' in the library.
const ZOOM_CONFIG = { enableLog: __DEV__ };

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const { session, isReady, expired } = useAuth();

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  // Keep class reminders in sync with the session. Self-fetches bookings, so it
  // covers cold start and time elapsed while the app was closed (past reminders
  // drop). Keyed on `session` — NOT onAuthExchange, which skips cold-start
  // hydration. Sign-out (session → null) clears every reminder we scheduled.
  useEffect(() => {
    if (session != null) void syncClassReminders();
    else void cancelAllReminders();
  }, [session]);

  // Keep the native splash up until the persisted session has been read.
  if (!isReady) return null;

  const isSignedIn = session != null;

  return (
    <Stack>
      {/* Authenticated experiences — gated on a present (not yet validated) token. */}
      <Stack.Protected guard={isSignedIn && !expired}>
        <Stack.Screen name="(tabs)"           options={{ headerShown: false }} />
        {/* Video screens (S14 pre-join + S15 room) live in the (video) group so
            the Zoom SDK provider is scoped to them — see app/(video)/_layout.tsx.
            The group is parenthesized, so URLs stay /video-prejoin, /video-room. */}
        <Stack.Screen name="(video)"          options={{ headerShown: false }} />
        <Stack.Screen name="review"           options={{ headerShown: false }} />
        <Stack.Screen name="add-to-calendar"  options={{ headerShown: false, presentation: 'modal' }} />
      </Stack.Protected>

      {/* S02 re-login — a present session lapsed beyond silent refresh. Tab bar
          hides automatically (this route lives outside (tabs)). */}
      <Stack.Protected guard={isSignedIn && expired}>
        <Stack.Screen name="session-expired"  options={{ headerShown: false }} />
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
        <LocaleProvider>
          <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} urlScheme="gustavoai">
            {/* Zoom SDK provider is mounted ONCE here (app-session singleton) so the
                native SDK inits exactly once. It must NOT live in the (video) group:
                that layout remounts on every entry, and the library re-calls initSdk
                with no unmount cleanup — a second init on the already-initialized SDK
                returns an error the native module rejects with a null userInfo, which
                NPE-crashes the app (RNZoomVideoSdkModule.initSdk). */}
            <ZoomVideoSdkProvider config={ZOOM_CONFIG}>
              <RootNavigator />
            </ZoomVideoSdkProvider>
          </StripeProvider>
        </LocaleProvider>
      </AuthProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
