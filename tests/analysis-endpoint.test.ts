import { beforeEach, expect, it, vi } from 'vitest';
import { ANALYSIS_VERSION } from '../supabase/functions/_shared/analysis-schema';
const mocks = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<unknown>),
  previous: null as unknown,
  spread: -4.5 as number | null,
  fetch: vi.fn(),
  insert: vi.fn(),
  eq: vi.fn(),
  claim: vi.fn(),
}));
vi.mock('../supabase/functions/_shared/http.ts', () => ({
  serve: (handler: (req: Request) => Promise<unknown>) => {
    mocks.handler = handler;
  },
  gameId: async () => 'test-game',
  claim: mocks.claim,
  timedFetch: mocks.fetch,
  HttpError: class extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  admin: () => ({
    from: () => {
      const query = {
        upsert: async () => ({ error: null }),
        select: () => query,
        eq: (...args: unknown[]) => {
          mocks.eq(...args);
          return query;
        },
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: mocks.previous, error: null }),
        insert: mocks.insert,
      };
      return query;
    },
  }),
}));
vi.mock('../supabase/functions/_shared/odds.ts', () => ({
  currentOdds: async () => ({
    stale: false,
    fetchedAt: '2026-10-04T12:00:00Z',
    games: [
      {
        id: 'test-game',
        sportKey: 'americanfootball_nfl',
        homeTeam: 'Home',
        awayTeam: 'Away',
        commenceTime: '2026-10-05T12:00:00Z',
        market: {
          consensusSpread: mocks.spread,
          consensusTotal: 43.5,
          bookmakerCount: 8,
          spreadBookCount: 8,
          sportsbooks: [],
        },
      },
    ],
  }),
}));
vi.mock('../supabase/functions/_shared/stored.ts', () => ({
  storedHistory: async () => ({ databaseId: 'db-game', points: [] }),
}));
const analysis = {
  lean: 'PASS',
  confidence: 60,
  summary: 'No edge established.',
  marketAnalysis: 'Agreement does not imply a covering advantage.',
  weatherAnalysis: null,
  injuryAnalysis: null,
  keyFactors: [],
  riskFactors: [],
};
function provider(result: unknown) {
  return {
    ok: true,
    json: async () => ({
      status: 'completed',
      output: [
        { content: [{ type: 'output_text', text: JSON.stringify(result) }] },
      ],
    }),
  };
}
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.previous = null;
  mocks.spread = -4.5;
  vi.stubGlobal('Deno', {
    env: {
      get: (name: string) =>
        name === 'OPENAI_API_KEY' ? 'test-key' : undefined,
    },
  });
  mocks.claim.mockResolvedValue(true);
  mocks.insert.mockResolvedValue({ error: null });
  mocks.fetch.mockResolvedValue(provider(analysis));
  await import('../supabase/functions/analyze-game/index');
});
const run = () =>
  mocks.handler!(new Request('https://test/analyze', { method: 'POST' }));
it('sends the exact policy in the saved input and uses a constrained output schema', async () => {
  await expect(run()).resolves.toMatchObject({ analysis });
  const request = JSON.parse(mocks.fetch.mock.calls[0][1].body);
  const saved = mocks.insert.mock.calls[0][0];
  expect(request.text.format.schema.properties.lean).toEqual({
    enum: ['PASS'],
    type: 'string',
  });
  expect(saved.analysis_version).toBe(ANALYSIS_VERSION);
  expect(saved.input_snapshot).toEqual(JSON.parse(request.input));
  expect(saved.input_snapshot.analysisPolicy.requiredLean).toBe('PASS');
  expect(mocks.eq).toHaveBeenCalledWith('analysis_version', ANALYSIS_VERSION);
});
it.each([
  { ...analysis, confidence: 0.6 },
  { ...analysis, lean: 'AWAY' },
])('does not store malformed or unsupported model output', async (response) => {
  mocks.fetch.mockResolvedValue(provider(response));
  await expect(run()).rejects.toMatchObject({ status: 502 });
  expect(mocks.insert).not.toHaveBeenCalled();
});
it('regenerates instead of serving a legacy cached directional response', async () => {
  mocks.previous = {
    result: { ...analysis, lean: 'AWAY', confidence: 0.6 },
    analysis_version: '1',
    model: 'old',
    created_at: new Date().toISOString(),
  };
  await expect(run()).resolves.toMatchObject({ analysis });
  expect(mocks.fetch).toHaveBeenCalledOnce();
});
it('serves only validated current-version cache without paid inference', async () => {
  mocks.previous = {
    result: analysis,
    analysis_version: ANALYSIS_VERSION,
    model: 'test-model',
    created_at: new Date().toISOString(),
  };
  await expect(run()).resolves.toMatchObject({ analysis });
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.claim).not.toHaveBeenCalled();
});
it('requires INSUFFICIENT_DATA and zero confidence when spread is absent', async () => {
  mocks.spread = null;
  const missing = { ...analysis, lean: 'INSUFFICIENT_DATA', confidence: 0 };
  mocks.fetch.mockResolvedValue(provider(missing));
  await expect(run()).resolves.toMatchObject({ analysis: missing });
  expect(
    mocks.insert.mock.calls[0][0].input_snapshot.analysisPolicy.requiredLean,
  ).toBe('INSUFFICIENT_DATA');
});
