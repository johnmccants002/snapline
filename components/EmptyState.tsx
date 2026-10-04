import { Text } from 'react-native';
import { SectionCard } from './SectionCard';
import { styles } from '../constants/theme';
export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <SectionCard title={title}>
      <Text style={styles.muted}>{message}</Text>
    </SectionCard>
  );
}
