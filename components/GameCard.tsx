import { useQuery } from '@tanstack/react-query';
import { getGameLineHistory } from '../lib/api/games';
import { signed } from '../lib/calculations/consensus';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { NFLGame } from '../types/game';
import { styles, colors } from '../constants/theme';
import { TeamRow } from './TeamRow';
import { OddsSummary } from './OddsSummary';
export const kickoffLabel = (time: string) =>
  new Date(time).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
export function GameCard({ game }: { game: NFLGame }) {
  const history = useQuery({
    queryKey: ['history', game.id],
    queryFn: () => getGameLineHistory(game.id),
  });
  const points = history.data ?? [];
  const movement =
    points.length > 1
      ? points[points.length - 1].homeSpread - points[0].homeSpread
      : null;
  return (
    <Link href={{ pathname: '/game/[id]', params: { id: game.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${game.awayTeam} at ${game.homeTeam}`}
        style={({ pressed }) => [styles.card, { opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={styles.row}>
          <Text style={styles.label}>{kickoffLabel(game.commenceTime)}</Text>
          <Text style={[styles.label, { color: colors.accent }]}>NFL</Text>
        </View>
        <TeamRow name={game.awayTeam} location="away" />
        <TeamRow name={game.homeTeam} location="home" />
        <View style={styles.divider} />
        <OddsSummary game={game} />
        <Text style={styles.muted}>
          {movement === null
            ? 'Movement awaiting stored snapshots'
            : movement === 0
              ? 'Home spread unchanged since first observation'
              : `Home spread ${signed(movement)} pts since first observation`}
        </Text>
        <Text style={styles.muted}>
          Weather unavailable · Injuries unavailable
        </Text>
        <View style={styles.row}>
          <Text style={styles.muted}>Analysis on request</Text>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>
            View game ↗
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}
