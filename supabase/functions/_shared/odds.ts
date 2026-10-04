import { admin, claim, HttpError, timedFetch } from './http.ts';
import { normalizeOdds } from './normalize.ts';
import type { OddsResponse } from './domain.ts';
export async function currentOdds(): Promise<OddsResponse> {
  const db = admin();
  const { data: cached, error } = await db
    .from('api_cache')
    .select('payload,updated_at')
    .eq('key', 'nfl-odds')
    .maybeSingle();
  if (error) throw error;
  const age = cached ? Date.now() - Date.parse(cached.updated_at) : Infinity;
  if (cached && age < 60000)
    return { ...(cached.payload as OddsResponse), stale: false };
  const key = Deno.env.get('ODDS_API_KEY');
  if (!key) throw new HttpError(503, 'NFL odds are not configured yet.');
  if (!(await claim('nfl-odds', 60))) {
    if (cached && age < 15 * 60000)
      return { ...(cached.payload as OddsResponse), stale: true };
    throw new HttpError(
      429,
      'Market refresh is in progress. Try again in a minute.',
    );
  }
  try {
    const url = new URL(
      'https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds',
    );
    url.search = new URLSearchParams({
      apiKey: key,
      regions: 'us',
      markets: 'spreads,totals,h2h',
      oddsFormat: 'american',
    }).toString();
    const response = await timedFetch(url);
    if (!response.ok)
      throw new HttpError(
        response.status === 429 ? 429 : 503,
        response.status === 429
          ? 'Odds provider quota reached. Please try later.'
          : 'NFL odds provider is unavailable.',
      );
    let games;
    try {
      games = normalizeOdds(await response.json());
    } catch {
      throw new HttpError(502, 'Odds provider returned an invalid response.');
    }
    const payload: OddsResponse = {
      games,
      fetchedAt: new Date().toISOString(),
      stale: false,
    };
    const { error: saveError } = await db
      .from('api_cache')
      .upsert({ key: 'nfl-odds', payload, updated_at: payload.fetchedAt });
    if (saveError) throw saveError;
    return payload;
  } catch (err) {
    if (cached && age < 15 * 60000)
      return { ...(cached.payload as OddsResponse), stale: true };
    throw err;
  }
}
