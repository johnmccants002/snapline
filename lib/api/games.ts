import type { OddsResponse } from '../../types/game';
import { invoke } from './invoke';
import { getSupabase } from '../supabase';
import {
  buildHistory,
  type Snapshot,
} from '../../supabase/functions/_shared/history';
export const getNFLGames = () => invoke<OddsResponse>('nfl-odds');
export async function getGame(id: string) {
  const result = await getNFLGames();
  const game = result.games.find((g) => g.id === id);
  if (!game)
    throw new Error(
      'This game is no longer available in the current odds feed.',
    );
  return { game, fetchedAt: result.fetchedAt, stale: result.stale };
}
export async function getGameLineHistory(id: string) {
  const db = getSupabase();
  const { data: game, error } = await db
    .from('games')
    .select('id')
    .eq('external_game_id', id)
    .maybeSingle();
  if (error)
    throw new Error(
      'Stored market history is unavailable. Check the database migration.',
    );
  if (!game) return [];
  const rows: Snapshot[] = [];
  for (let offset = 0; offset < 50000; offset += 1000) {
    const { data, error } = await db
      .from('odds_snapshots')
      .select('captured_at,bookmaker_key,home_spread')
      .eq('game_id', game.id)
      .gte('captured_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('captured_at')
      .order('bookmaker_key')
      .range(offset, offset + 999);
    if (error)
      throw new Error('Unable to load line history. Pull to refresh to retry.');
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return buildHistory(rows);
}
