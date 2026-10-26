import { describe, expect, it } from 'vitest';
import { marketNarrative } from '../supabase/functions/_shared/market-facts';
import { validateMarketAnalysis } from '../supabase/functions/_shared/analysis-schema';
const market = (values: (number | null)[]) => ({
  consensusSpread: -3,
  sportsbooks: values.map((homeSpread, i) => ({ key: String(i), homeSpread })),
});
const point = (day: number, homeSpread: number) => ({
  capturedAt: `2026-10-0${day}T12:00:00Z`,
  homeSpread,
  bookCount: 2,
});
describe('computed market facts', () => {
  it('distinguishes agreement from differing quotes and missing quotes', () => {
    expect(marketNarrative(market([-3, -3]), []).marketAnalysis).toContain(
      'All 2 usable',
    );
    expect(marketNarrative(market([-3, -3.5]), []).marketAnalysis).toContain(
      'quotes differ',
    );
    expect(
      marketNarrative(market([null, NaN, -3]), []).marketAnalysis,
    ).toContain('agreement cannot be established');
  });
  it('does not double count duplicate books', () => {
    const data = market([-3, -3]);
    data.sportsbooks[1].key = '0';
    expect(marketNarrative(data, []).marketAnalysis).toContain('Only 1 usable');
    data.sportsbooks[1].homeSpread = -4;
    expect(marketNarrative(data, []).marketAnalysis).toContain('Only 0 usable');
  });
  it.each(
    [[], [point(1, -3)], [point(1, -3), point(1, -3)]].map((points) => ({
      points,
    })),
  )('requires distinct times for movement', ({ points }) => {
    expect(marketNarrative(market([-3]), points).marketAnalysis).toContain(
      'movement is unknown',
    );
  });
  it('sorts history and preserves intermediate changes with zero net movement', () => {
    const text = marketNarrative(market([-3]), [
      point(3, -3),
      point(1, -3),
      point(2, -4),
    ]).marketAnalysis;
    expect(text).toContain('net change 0');
    expect(text).toContain('changed within');
    expect(text).toContain('not a verified opening');
  });
  it('limits unchanged claims to observed samples', () => {
    expect(
      marketNarrative(market([-3]), [point(1, -3), point(2, -3)])
        .marketAnalysis,
    ).toContain('changes between samples are unknown');
  });
  it('filters invalid and conflicting historical points', () => {
    expect(
      marketNarrative(market([-3]), [
        point(1, -3),
        point(1, -4),
        { ...point(2, -3), capturedAt: 'invalid' },
        point(3, NaN),
      ]).marketAnalysis,
    ).toContain('movement is unknown');
  });
  it.each([
    [-3, 'favorite'],
    [3, 'underdog'],
    [0, 'pick’em'],
    [null, 'INSUFFICIENT_DATA'],
  ] as const)('interprets home handicap %s', (spread, label) => {
    expect(
      marketNarrative({ ...market([]), consensusSpread: spread }, []).summary,
    ).toContain(label);
  });
  it('rejects unsupported claims in every prose surface', () => {
    const narrative = marketNarrative(market([-3, -4]), []);
    const valid = {
      ...narrative,
      lean: 'PASS',
      confidence: 60,
      weatherAnalysis: null,
      injuryAnalysis: null,
      keyFactors: [],
      riskFactors: [],
    };
    expect(validateMarketAnalysis(valid, 'PASS', narrative)).toEqual(valid);
    for (const patch of [
      { summary: 'Home should cover' },
      { marketAnalysis: 'All books agree' },
      { weatherAnalysis: 'Clear' },
      { injuryAnalysis: 'Healthy' },
      { riskFactors: ['Sharp money'] },
      {
        keyFactors: [
          {
            factor: 'Agreement',
            direction: 'NEUTRAL',
            importance: 'HIGH',
            explanation: 'All agree',
          },
        ],
      },
    ]) {
      expect(() =>
        validateMarketAnalysis({ ...valid, ...patch }, 'PASS', narrative),
      ).toThrow();
    }
  });
});
