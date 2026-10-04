import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { getGame, getGameLineHistory } from '../../lib/api/games';
import { styles, colors } from '../../constants/theme';
import { TeamRow } from '../../components/TeamRow';
import { kickoffLabel } from '../../components/GameCard';
import { SectionCard } from '../../components/SectionCard';
import { OddsSummary } from '../../components/OddsSummary';
import { SportsbookLines } from '../../components/SportsbookLines';
import { LineMovementChart } from '../../components/LineMovementChart';
import { WeatherCard } from '../../components/WeatherCard';
import { InjuryCard } from '../../components/InjuryCard';
import { AnalysisCard } from '../../components/AnalysisCard';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { team } from '../../constants/teams';
export default function GameDetail() {
  const params = useLocalSearchParams<{ id: string }>(),
    id = Array.isArray(params.id) ? params.id[0] : params.id;
  const query = useQuery({
    queryKey: ['game', id],
    queryFn: () => getGame(id),
    enabled: !!id,
    refetchInterval: 60000,
  });
  const history = useQuery({
    queryKey: ['history', id],
    queryFn: () => getGameLineHistory(id),
    enabled: !!id,
  });
  const game = query.data?.game;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          tintColor={colors.accent}
          refreshing={query.isRefetching || history.isRefetching}
          onRefresh={() => {
            void query.refetch();
            void history.refetch();
          }}
        />
      }
    >
      {query.isPending ? <LoadingState /> : null}
      {query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {game && (
        <>
          <View style={[styles.card, { paddingVertical: 28 }]}>
            <Text style={styles.label}>Matchup / NFL</Text>
            <TeamRow name={game.awayTeam} location="away" />
            <Text style={styles.muted}>at</Text>
            <TeamRow name={game.homeTeam} location="home" />
            <Text style={styles.muted}>
              {kickoffLabel(game.commenceTime)} · Local time
            </Text>
          </View>
          <SectionCard title="Market overview">
            <OddsSummary game={game} />
            <Text style={styles.muted}>
              Median across {game.market.spreadBookCount} spread-reporting{' '}
              {game.market.spreadBookCount === 1 ? 'book' : 'books'}. Negative
              spread means home favorite.
            </Text>
            {game.market.spreadBookCount === 1 && (
              <Text style={{ color: colors.warning }}>
                One sportsbook only; consensus is limited.
              </Text>
            )}
            <Text style={styles.muted}>Opening spread: Unavailable</Text>
            <Text
              style={[
                styles.muted,
                query.data?.stale ? { color: colors.warning } : {},
              ]}
            >
              {query.data?.stale ? 'Delayed market · ' : ''}Observed{' '}
              {new Date(query.data!.fetchedAt).toLocaleString()}
            </Text>
          </SectionCard>
          <SportsbookLines game={game} />
          {history.isPending ? (
            <SectionCard title="Line movement">
              <Text style={styles.muted}>Loading stored observations…</Text>
            </SectionCard>
          ) : history.error ? (
            <ErrorState
              error={history.error}
              onRetry={() => void history.refetch()}
            />
          ) : (
            <LineMovementChart
              points={history.data ?? []}
              homeTeam={team(game.homeTeam).abbreviation}
            />
          )}
          <WeatherCard />
          <InjuryCard />
          <AnalysisCard key={id} id={id} />
        </>
      )}
    </ScrollView>
  );
}
