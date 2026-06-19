import { Tabs } from 'expo-router';
import React from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';

// Open on the Inicio tab (otherwise expo-router defaults to the first route
// alphabetically, which is (booking)).
export const unstable_settings = {
  initialRouteName: '(home)',
};

export default function TabLayout() {
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
          title: 'Inicio',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons size={26} name={focused ? 'home' : 'home-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(booking)"
        options={{
          title: 'Reservar',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons size={26} name={focused ? 'calendar' : 'calendar-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(packs)"
        options={{
          title: 'Packs',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons size={26} name={focused ? 'gift' : 'gift-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons size={26} name={focused ? 'account' : 'account-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
