import { admin, HttpError, serve } from '../_shared/http.ts';
import { currentOdds } from '../_shared/odds.ts';
serve(async (req) => {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || req.headers.get('Authorization') !== `Bearer ${secret}`)
    throw new HttpError(403, 'This operation requires an administrator.');
  const odds = await currentOdds();
  if (odds.stale)
    throw new HttpError(
      503,
      'Cannot capture a stale market. Retry after the provider recovers.',
    );
  const { data, error } = await admin().rpc('store_odds_sync', {
    games_payload: odds.games,
    capture_time: odds.fetchedAt,
  });
  if (error) throw error;
  return { ...data, capturedAt: odds.fetchedAt };
});
