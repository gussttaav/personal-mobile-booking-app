import { StyleSheet, Text, View } from 'react-native';
import { Colors, TypeScale } from '@/constants/theme';

export default function SessionExpiredScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>S02 · Sesión expirada · Re-login</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  label: { color: Colors.text, ...TypeScale.h3 },
});
