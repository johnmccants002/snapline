import {
  admin,
  claim,
  gameId,
  HttpError,
  serve,
  timedFetch,
} from '../_shared/http.ts';
import { currentOdds } from '../_shared/odds.ts';
import { storedHistory } from '../_shared/stored.ts';
import {
  analysisInstructions,
  ANALYSIS_VERSION,
  marketDecision,
  marketAnalysisJsonSchema,
  readCachedAnalysis,
  validateMarketAnalysis,
} from '../_shared/analysis-schema.ts';
serve(async (req) => {
  const id = await gameId(req),
    db = admin();
  const { games, stale, fetchedAt } = await currentOdds();
  const game = games.find((g) => g.id === id);
  if (!game)
    throw new HttpError(404, 'Game is no longer in the current odds feed.');
  if (stale)
    throw new HttpError(503, 'Fresh market data is required for analysis.');
  const { error: upsertError } = await db.from('games').upsert(
    {
      external_game_id: id,
      sport_key: game.sportKey,
      home_team: game.homeTeam,
      away_team: game.awayTeam,
      commence_time: game.commenceTime,
    },
    { onConflict: 'external_game_id' },
  );
  if (upsertError) throw upsertError;
  const { databaseId, points } = await storedHistory(id);
  const { data: previous, error: previousError } = await db
    .from('game_analyses')
    .select('result,created_at,model,analysis_version')
    .eq('game_id', databaseId)
    .eq('analysis_version', ANALYSIS_VERSION)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousError) throw previousError;
  const decision = marketDecision(game.market.consensusSpread);
  const cached = readCachedAnalysis(previous, decision);
  if (cached) return cached;
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new HttpError(503, 'AI analysis is not configured yet.');
  if (
    !(await claim(`analysis:${id}`, 600)) ||
    !(await claim('analysis:global', 20))
  )
    throw new HttpError(429, 'Analysis limit reached. Please try again later.');
  const input = {
    analysisPolicy: {
      version: ANALYSIS_VERSION,
      evidenceMode: 'market_only',
      requiredLean: decision,
    },
    game: {
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      kickoffTime: game.commenceTime,
      consensusSpread: game.market.consensusSpread,
      consensusTotal: game.market.consensusTotal,
    },
    market: {
      bookmakerCount: game.market.bookmakerCount,
      spreadBookCount: game.market.spreadBookCount,
      currentConsensusSpread: game.market.consensusSpread,
      openingSpread: null,
      firstObservedSpread: points[0]?.homeSpread ?? null,
      lineMovement: points,
      observedAt: fetchedAt,
      sportsbooks: game.market.sportsbooks,
    },
    weather: null,
    injuries: [],
    model: null,
    dataAvailability: {
      weather: 'not_configured',
      injuries: 'not_configured',
      quantitativeModel: 'not_configured',
    },
  };
  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';
  const response = await timedFetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions: analysisInstructions,
      input: JSON.stringify(input),
      max_output_tokens: 3000,
      text: {
        format: {
          type: 'json_schema',
          name: 'game_analysis',
          strict: true,
          schema: marketAnalysisJsonSchema(decision),
        },
      },
    }),
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => null);
    const code = failure?.error?.code;
    if (code === 'credit_balance_exhausted' || code === 'insufficient_quota')
      throw new HttpError(
        503,
        'AI analysis is unavailable because the provider credit balance is exhausted. The project owner needs to add OpenAI API credits.',
      );
    throw new HttpError(
      503,
      'AI provider is unavailable. Please try again later.',
    );
  }
  const raw = await response.json();
  let analysis;
  try {
    if (raw.status !== 'completed') throw new Error('Incomplete response');
    const output = raw.output.flatMap(
      (item: { content?: { type: string; text?: string }[] }) =>
        item.content ?? [],
    );
    if (output.some((item: { type: string }) => item.type === 'refusal'))
      throw new Error('Refusal');
    const text = output
      .filter((item: { type: string }) => item.type === 'output_text')
      .map((item: { text: string }) => item.text)
      .join('');
    analysis = validateMarketAnalysis(JSON.parse(text), decision);
  } catch {
    throw new HttpError(
      502,
      'AI returned an incomplete or invalid analysis. Please try later.',
    );
  }
  const createdAt = new Date().toISOString();
  const { error } = await db.from('game_analyses').insert({
    game_id: databaseId,
    model,
    analysis_version: ANALYSIS_VERSION,
    lean: analysis.lean,
    confidence: analysis.confidence,
    summary: analysis.summary,
    market_analysis: analysis.marketAnalysis,
    weather_analysis: analysis.weatherAnalysis,
    injury_analysis: analysis.injuryAnalysis,
    key_factors: analysis.keyFactors,
    risk_factors: analysis.riskFactors,
    input_snapshot: input,
    result: analysis,
    created_at: createdAt,
  });
  if (error) throw error;
  return { analysis, createdAt, model };
});
