import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_VERSION,
  marketDecision,
  marketAnalysisJsonSchema,
  readCachedAnalysis,
  validateMarketAnalysis,
} from '../supabase/functions/_shared/analysis-schema';
const result = {
  lean: 'PASS',
  confidence: 60,
  summary: 'No independent edge established.',
  marketAnalysis: 'Market observation only.',
  weatherAnalysis: null,
  injuryAnalysis: null,
  keyFactors: [],
  riskFactors: ['Weather unavailable', 'Injuries unavailable'],
};
describe('market-only evidence policy', () => {
  it.each([-7, 7, 0, -2.5, 4.5])(
    'requires PASS for home spread %s regardless of favorite',
    (spread) => {
      const decision = marketDecision(spread);
      expect(decision).toBe('PASS');
      expect(validateMarketAnalysis(result, decision).lean).toBe('PASS');
      for (const lean of ['HOME', 'AWAY'])
        expect(() =>
          validateMarketAnalysis({ ...result, lean }, decision),
        ).toThrow();
    },
  );
  it.each([null, NaN, Infinity])(
    'requires insufficient data without usable spread %s',
    (spread) => {
      const decision = marketDecision(spread);
      expect(decision).toBe('INSUFFICIENT_DATA');
      expect(
        validateMarketAnalysis(
          { ...result, lean: decision, confidence: 0 },
          decision,
        ).confidence,
      ).toBe(0);
      expect(() => validateMarketAnalysis(result, decision)).toThrow();
      expect(() =>
        validateMarketAnalysis({ ...result, lean: decision }, decision),
      ).toThrow();
    },
  );
  it('rejects contradictory directional factors instead of relabeling their prose', () => {
    expect(() =>
      validateMarketAnalysis(
        {
          ...result,
          keyFactors: [
            {
              factor: 'Favorite',
              direction: 'AWAY',
              importance: 'HIGH',
              explanation: 'The favorite should cover.',
            },
          ],
        },
        'PASS',
      ),
    ).toThrow();
  });
  it('publishes numeric and decision constraints to OpenAI', () => {
    const schema = marketAnalysisJsonSchema('PASS');
    expect(schema.properties?.confidence).toMatchObject({
      type: 'integer',
      minimum: 0,
      maximum: 100,
    });
    expect(schema.properties?.lean).toMatchObject({ enum: ['PASS'] });
  });
});
describe('versioned analysis cache', () => {
  const now = Date.parse('2026-10-04T12:00:00Z');
  const row = {
    result,
    created_at: new Date(now - 1000).toISOString(),
    model: 'test-model',
    analysis_version: ANALYSIS_VERSION,
  };
  it('reuses a valid recent current-version response', () =>
    expect(readCachedAnalysis(row, 'PASS', now)?.analysis).toEqual(result));
  it('rejects legacy, expired, invalid-date, future, malformed, or policy-incompatible entries', () => {
    for (const candidate of [
      null,
      { ...row, analysis_version: '1' },
      { ...row, created_at: new Date(now - 600000).toISOString() },
      { ...row, created_at: 'invalid' },
      { ...row, created_at: new Date(now + 1000).toISOString() },
      { ...row, result: { ...result, confidence: 0.6 } },
      { ...row, result: { ...result, lean: 'AWAY' } },
      { ...row, result: { ...result, confidence: 101 } },
    ])
      expect(readCachedAnalysis(candidate, 'PASS', now)).toBeNull();
    expect(readCachedAnalysis(row, 'INSUFFICIENT_DATA', now)).toBeNull();
  });
});
