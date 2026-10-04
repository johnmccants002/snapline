import { describe, expect, it } from 'vitest';
import { consensusSpread } from '../supabase/functions/_shared/consensus';
import { normalizeOdds } from '../supabase/functions/_shared/normalize';
import { buildHistory } from '../supabase/functions/_shared/history';
import { validateAnalysis } from '../supabase/functions/_shared/analysis-schema';
describe('home-oriented consensus', () => {
  it.each([
    [[-4.5, -4.5, -4.5], -4.5],
    [[-4.5, -4, -3], -4],
    [[-4, -3], -3.5],
    [[null, -4, null], -4],
    [[-7, -6, -6], -6],
    [[3, 4, 4], 4],
    [[0, 0, 0], 0],
    [[null, undefined, NaN, Infinity, '3'], null],
    [[], null],
  ])('median of %j is %s', (values, expected) =>
    expect(consensusSpread(values.map((homeSpread) => ({ homeSpread })))).toBe(
      expected,
    ),
  );
  it('handles malformed books', () => {
    expect(consensusSpread([null, {}, 'bad', { homeSpread: 2 }])).toBe(2);
    expect(consensusSpread(null)).toBeNull();
  });
});
const event = (bookmakers: unknown[]) => [
  {
    id: 'game1',
    sport_key: 'americanfootball_nfl',
    home_team: 'Buffalo Bills',
    away_team: 'New England Patriots',
    commence_time: '2026-10-04T17:00:00Z',
    bookmakers,
  },
];
const book = (markets: unknown[]) => ({
  key: 'test',
  title: 'Test book',
  markets,
});
it('normalizes away-only spreads and missing markets', () => {
  const [game] = normalizeOdds(
    event([
      book([
        {
          key: 'spreads',
          outcomes: [{ name: 'New England Patriots', point: 4.5, price: -110 }],
        },
      ]),
    ]),
  );
  expect(game.market.consensusSpread).toBe(-4.5);
  expect(game.market.consensusTotal).toBeNull();
  expect(game.market.sportsbooks[0].homeMoneyline).toBeNull();
});
it('drops contradictory markets and malformed events without crashing', () => {
  const [game] = normalizeOdds(
    event([
      null,
      book([
        {
          key: 'spreads',
          outcomes: [
            { name: 'Buffalo Bills', point: -3 },
            { name: 'New England Patriots', point: 4 },
          ],
        },
      ]),
    ]),
  );
  expect(game.market.consensusSpread).toBeNull();
  expect(normalizeOdds([null, {}])).toEqual([]);
  expect(() => normalizeOdds({})).toThrow();
});
it('deduplicates books before calculating consensus', () => {
  const b = book([
    { key: 'spreads', outcomes: [{ name: 'Buffalo Bills', point: 0 }] },
  ]);
  expect(normalizeOdds(event([b, b]))[0].market.bookmakerCount).toBe(1);
});
it('groups complete observations by time and ignores missing spreads', () => {
  expect(
    buildHistory([
      { captured_at: '2026-01-01', bookmaker_key: 'a', home_spread: -3 },
      { captured_at: '2026-01-01', bookmaker_key: 'b', home_spread: -4 },
      { captured_at: '2026-01-02', bookmaker_key: 'a', home_spread: 0 },
      { captured_at: '2026-01-02', bookmaker_key: 'b', home_spread: null },
    ]),
  ).toEqual([
    { capturedAt: '2026-01-01', homeSpread: -3.5, bookCount: 2 },
    { capturedAt: '2026-01-02', homeSpread: 0, bookCount: 1 },
  ]);
});
const analysis = {
  lean: 'PASS',
  confidence: 150,
  summary: 'Limited evidence',
  marketAnalysis: 'One book',
  weatherAnalysis: null,
  injuryAnalysis: null,
  keyFactors: [],
  riskFactors: ['Missing weather'],
};
it('validates structured analysis and clamps confidence', () => {
  expect(validateAnalysis(analysis).confidence).toBe(100);
  expect(validateAnalysis({ ...analysis, confidence: -20 }).confidence).toBe(0);
  expect(() => validateAnalysis({ ...analysis, lean: 'LOCK' })).toThrow();
  expect(() => validateAnalysis({ ...analysis, confidence: '54' })).toThrow();
  expect(() => validateAnalysis({ ...analysis, extra: true })).toThrow();
});
