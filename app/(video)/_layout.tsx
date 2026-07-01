import { Stack } from 'expo-router';

// Groups the full-screen, tab-bar-hidden video routes (S14 pre-join + S15 room).
// The Zoom SDK provider is NOT here — it's an app-session singleton at the root
// (app/_layout.tsx). Mounting it in this group would re-init the native SDK on
// every entry (the library re-calls initSdk with no unmount cleanup), which
// NPE-crashes on the second init. `(video)` is parenthesized so URLs stay
// /video-prejoin and /video-room.
export default function VideoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="video-prejoin" />
      <Stack.Screen name="video-room" />
    </Stack>
  );
}
