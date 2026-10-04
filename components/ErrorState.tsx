import { Pressable, Text, View } from 'react-native';
import { colors, styles } from '../constants/theme';
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.card} accessibilityRole="alert">
      <Text style={[styles.heading, { color: colors.warning }]}>
        Data unavailable
      </Text>
      <Text style={styles.muted}>
        {error instanceof Error ? error.message : 'Please try again shortly.'}
      </Text>
      {onRetry && (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}
