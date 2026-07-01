import { StyleSheet, Text, View } from 'react-native';
import { Colors, TypeScale } from '@/constants/theme';

export default function VideoRoomScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>S15 · Sala · en clase</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  label: { color: Colors.text, ...TypeScale.h3 },
});
