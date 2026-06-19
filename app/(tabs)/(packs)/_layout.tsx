import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'packs',
};

export default function PacksLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
