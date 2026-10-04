import { Text } from 'react-native';
import { colors } from '../constants/theme';
import type { GameAnalysis } from '../types/analysis';
export function EdgeBadge({ lean }: { lean: GameAnalysis['lean'] }) {
  return (
    <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 20 }}>
      {lean.replaceAll('_', ' ')}
    </Text>
  );
}
