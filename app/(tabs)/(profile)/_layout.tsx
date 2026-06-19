import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'profile',
};

export default function ProfileLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
