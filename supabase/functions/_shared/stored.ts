import { admin } from './http.ts';
import { buildHistory, type Snapshot } from './history.ts';
export async function storedHistory(id: string) {
  const db = admin();
  const { data: game, error } = await db
    .from('games')
    .select('id')
    .eq('external_game_id', id)
    .maybeSingle();
  if (error) throw error;
  if (!game) return { databaseId: null, points: [] };
  // Bound the window; each page has stable ordering. This avoids PostgREST's 1000-row truncation.
  const rows: Snapshot[] = [];
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  for (let offset = 0; offset < 50000; offset += 1000) {
    const { data, error: readError } = await db
      .from('odds_snapshots')
      .select('captured_at,bookmaker_key,home_spread')
      .eq('game_id', game.id)
      .gte('captured_at', since)
      .order('captured_at')
      .order('bookmaker_key')
      .range(offset, offset + 999);
    if (readError) throw readError;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return { databaseId: game.id, points: buildHistory(rows) };
}
