import { Text, View } from 'react-native';
import { SectionCard } from './SectionCard';
import type { NFLGame } from '../types/game';
import { styles } from '../constants/theme';
import { signed } from '../lib/calculations/consensus';
import { team } from '../constants/teams';
export function SportsbookLines({ game }: { game: NFLGame }) {
  return (
    <SectionCard title="Sportsbook spreads">
      <Text style={styles.muted}>
        All spreads shown for {team(game.homeTeam).abbreviation}. Prices are
        American odds.
      </Text>
      {!game.market.sportsbooks.length && (
        <Text style={styles.muted}>No sportsbooks are reporting yet.</Text>
      )}
      {game.market.sportsbooks.map((book) => (
        <View key={book.key} style={{ gap: 4 }}>
          <View style={styles.row}>
            <Text style={[styles.text, { flex: 1 }]}>{book.title}</Text>
            <Text style={styles.text}>{signed(book.homeSpread)}</Text>
            <Text style={[styles.muted, { minWidth: 42, textAlign: 'right' }]}>
              {book.homeSpreadPrice === null
                ? '—'
                : signed(book.homeSpreadPrice)}
            </Text>
          </View>
          <Text style={styles.muted}>
            Total {book.total ?? '—'} ·{' '}
            {book.lastUpdate
              ? `Updated ${new Date(book.lastUpdate).toLocaleTimeString()}`
              : 'Update time unavailable'}
          </Text>
        </View>
      ))}
    </SectionCard>
  );
}
