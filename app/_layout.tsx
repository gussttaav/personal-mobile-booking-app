import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

GoogleSignin.configure({
  webClientId: '676995776728-cj85r0hoia2rmtcllodmiqci0nbs3bkc.apps.googleusercontent.com',
});

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <Stack>
        <Stack.Screen name="(tabs)"           options={{ headerShown: false }} />
        <Stack.Screen name="login"            options={{ headerShown: false }} />
        <Stack.Screen name="session-expired"  options={{ headerShown: false }} />
        <Stack.Screen name="video-prejoin"    options={{ headerShown: false }} />
        <Stack.Screen name="video-room"       options={{ headerShown: false }} />
        <Stack.Screen name="review"           options={{ headerShown: false }} />
        <Stack.Screen name="add-to-calendar"  options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
