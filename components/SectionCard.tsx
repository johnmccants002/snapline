import type { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';
import { styles } from '../constants/theme';
export function SectionCard({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{title}</Text>
      {children}
    </View>
  );
}
