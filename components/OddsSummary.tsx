import { Text, View } from 'react-native';
import type { NFLGame } from '../types/game';
import { styles } from '../constants/theme';
import { SpreadBadge } from './SpreadBadge';
export function OddsSummary({ game }: { game: NFLGame }) {
  return (
    <View style={[styles.row, { alignItems: 'flex-start', flexWrap: 'wrap' }]}>
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Home spread</Text>
        <SpreadBadge
          homeTeam={game.homeTeam}
          value={game.market.consensusSpread}
        />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Total</Text>
        <Text style={styles.heading}>{game.market.consensusTotal ?? '—'}</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Books</Text>
        <Text style={styles.heading}>{game.market.bookmakerCount}</Text>
      </View>
    </View>
  );
}
