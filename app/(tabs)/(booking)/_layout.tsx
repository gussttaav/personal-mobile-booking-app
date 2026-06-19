import { Stack } from 'expo-router';

// session-type (S04) is the tab's landing screen; without this the stack would
// default to the alphabetically-first route (confirm-credit).
export const unstable_settings = {
  initialRouteName: 'session-type',
};

export default function BookingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
