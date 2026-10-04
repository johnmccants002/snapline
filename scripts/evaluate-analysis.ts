// Opt-in paid evaluation. Synthetic cases are never persisted or shown in the app.
import {
  ANALYSIS_VERSION,
  analysisInstructions,
  marketAnalysisJsonSchema,
  marketDecision,
  validateMarketAnalysis,
} from '../supabase/functions/_shared/analysis-schema.ts';

const key = Deno.env.get('OPENAI_API_KEY');
if (!key) throw new Error('Set OPENAI_API_KEY in .env.providers.');
const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';
for (const spread of [-4.5, 4.5, 0, null]) {
  const decision = marketDecision(spread);
  const input = {
    analysisPolicy: {
      version: ANALYSIS_VERSION,
      evidenceMode: 'market_only',
      requiredLean: decision,
    },
    game: {
      homeTeam: 'Home Team',
      awayTeam: 'Away Team',
      consensusSpread: spread,
      consensusTotal: 43.5,
    },
    market: {
      bookmakerCount: 8,
      spreadBookCount: spread === null ? 0 : 8,
      currentConsensusSpread: spread,
      openingSpread: null,
      lineMovement: [],
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
  const response = await fetch('https://api.openai.com/v1/responses', {
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
      max_output_tokens: 2000,
      text: {
        format: {
          type: 'json_schema',
          name: 'game_analysis',
          strict: true,
          schema: marketAnalysisJsonSchema(decision),
        },
      },
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok)
    throw new Error(`Provider HTTP ${response.status}; response body omitted.`);
  const raw = await response.json();
  if (raw.status !== 'completed') throw new Error('Incomplete response.');
  const content = raw.output.flatMap(
    (item: { content?: { type: string; text?: string }[] }) =>
      item.content ?? [],
  );
  if (content.some((item: { type: string }) => item.type === 'refusal'))
    throw new Error('Provider refusal.');
  const text = content
    .filter((item: { type: string }) => item.type === 'output_text')
    .map((item: { text: string }) => item.text)
    .join('');
  const analysis = validateMarketAnalysis(JSON.parse(text), decision);
  console.log(
    JSON.stringify({
      homeSpread: spread,
      lean: analysis.lean,
      confidence: analysis.confidence,
      summary: analysis.summary,
      marketAnalysis: analysis.marketAnalysis,
    }),
  );
}
console.log(
  'All four live cases passed schema and evidence-policy validation. Review prose above for semantic quality.',
);
