import { Tabs } from 'expo-router';
import React from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useT } from '@/lib/i18n/locale-context';

// Open on the Inicio tab (otherwise expo-router defaults to the first route
// alphabetically, which is (booking)).
export const unstable_settings = {
  initialRouteName: '(home)',
};

export default function TabLayout() {
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tint,
        tabBarInactiveTintColor: Colors.tabIconDefault,
        tabBarStyle: { backgroundColor: Colors.surfaceLow },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons size={26} name={focused ? 'home' : 'home-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(booking)"
        options={{
          title: t('tabs.booking'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons size={26} name={focused ? 'calendar' : 'calendar-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(packs)"
        options={{
          title: t('tabs.packs'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons size={26} name={focused ? 'gift' : 'gift-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons size={26} name={focused ? 'account' : 'account-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
