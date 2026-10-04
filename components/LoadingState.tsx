import { ActivityIndicator, View } from 'react-native';
import { colors, styles } from '../constants/theme';
export function LoadingState() {
  return (
    <View accessibilityLabel="Loading market data" style={{ gap: 16 }}>
      <ActivityIndicator color={colors.accent} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.card, { height: 180 }]}>
          <View
            style={{
              height: 18,
              width: '50%',
              backgroundColor: colors.subtle,
              borderRadius: 4,
            }}
          />
          <View
            style={{
              height: 50,
              backgroundColor: colors.subtle,
              borderRadius: 8,
            }}
          />
        </View>
      ))}
    </View>
  );
}
