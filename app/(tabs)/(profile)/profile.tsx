import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useAuth } from '@/lib/auth-context';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  // TEMP: sign-out lives here until S17 Perfil is built. Once the real Perfil
  // screen exists, move this action into its proper row and delete the stub UI.
  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut(); // clears the token + flips the guard → routes to login
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.label}>S17 · Perfil</Text>
      {session != null && <Text style={styles.email}>{session.user.email}</Text>}

      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={handleSignOut}
        activeOpacity={0.8}
        disabled={signingOut}
      >
        <MaterialCommunityIcons name="logout" size={18} color={Colors.error} />
        <Text style={styles.signOutText}>
          {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[4],
    padding: Spacing[6],
  },
  label: { color: Colors.text, ...TypeScale.h3 },
  email: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    backgroundColor: Colors.errorBg,
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[3],
    marginTop: Spacing[2],
  },
  signOutText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.error,
  },
});
