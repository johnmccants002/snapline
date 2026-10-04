import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getNFLGames } from '../lib/api/games';
import { colors, styles } from '../constants/theme';
import { GameCard } from '../components/GameCard';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
export default function Home() {
  const query = useQuery({
    queryKey: ['games'],
    queryFn: getNFLGames,
    refetchInterval: 60000,
  });
  const games = query.data?.games ?? [];
  const weeks = [
    ...new Set(games.map((g) => g.week).filter((w) => w !== null)),
  ];
  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.content}
        data={games}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => <GameCard game={item} />}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 18, paddingVertical: 14 }}>
            <View style={styles.row}>
              <Text
                style={{
                  color: colors.accent,
                  fontWeight: '800',
                  letterSpacing: 3,
                  fontSize: 15,
                }}
              >
                SNAPLINE /
              </Text>
              <Text style={styles.label}>Market intelligence</Text>
            </View>
            <View>
              <Text style={[styles.title, { fontSize: 48 }]}>NFL</Text>
              <Text style={styles.muted}>
                {weeks.length === 1
                  ? `Week ${weeks[0]}`
                  : 'Current & upcoming markets'}
              </Text>
            </View>
            <Text style={styles.text}>Understand the market.</Text>
            <Text style={styles.muted}>
              Sportsbook consensus, evidence, and perspective.
            </Text>
            {query.data && (
              <Text
                style={[
                  styles.muted,
                  query.data.stale ? { color: colors.warning } : {},
                ]}
              >
                {query.data.stale ? 'Delayed data · ' : ''}Observed{' '}
                {new Date(query.data.fetchedAt).toLocaleString()} ·{' '}
                {games.length} games
              </Text>
            )}
            {query.error && (
              <ErrorState
                error={query.error}
                onRetry={() => void query.refetch()}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          query.isPending ? (
            <LoadingState />
          ) : !query.error ? (
            <EmptyState
              title="No active NFL markets"
              message="No games are available from the odds provider right now. Pull to refresh when markets reopen."
            />
          ) : null
        }
        ListFooterComponent={
          <Text style={[styles.muted, { textAlign: 'center', marginTop: 12 }]}>
            Research, not certainty. Odds can change before kickoff.
          </Text>
        }
      />
    </SafeAreaView>
  );
}
