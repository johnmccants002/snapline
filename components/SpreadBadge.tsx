import { Text } from 'react-native';
import { signed } from '../lib/calculations/consensus';
import { team } from '../constants/teams';
import { colors } from '../constants/theme';
export function SpreadBadge({
  homeTeam,
  value,
}: {
  homeTeam: string;
  value: number | null;
}) {
  return (
    <Text style={{ fontSize: 22, fontWeight: '700', color: colors.accent }}>
      {value === null ? '—' : `${team(homeTeam).abbreviation} ${signed(value)}`}
    </Text>
  );
}
