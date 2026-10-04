import type { NFLGame, SportsbookOdds } from './domain.ts';
import { consensusSpread, median } from './consensus.ts';
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const date = (v: unknown): string | null =>
  typeof v === 'string' && Number.isFinite(Date.parse(v))
    ? new Date(v).toISOString()
    : null;
function normalizeBook(
  value: unknown,
  home: string,
  away: string,
): SportsbookOdds | null {
  const b = obj(value);
  if (typeof b.key !== 'string' || typeof b.title !== 'string') return null;
  const markets = arr(b.markets).map(obj);
  const outcome = (market: string, name: string) =>
    obj(
      arr(markets.find((m) => m.key === market)?.outcomes).find(
        (o) => obj(o).name === name,
      ),
    );
  const h = outcome('spreads', home),
    a = outcome('spreads', away);
  let hs = num(h.point),
    as = num(a.point);
  if (hs !== null && as !== null && hs !== -as) {
    hs = null;
    as = null;
  } else {
    hs = hs ?? (as === null ? null : -as);
    as = as ?? (hs === null ? null : -hs);
  }
  const over = outcome('totals', 'Over'),
    under = outcome('totals', 'Under');
  const ot = num(over.point),
    ut = num(under.point);
  const total = ot !== null && ut !== null && ot !== ut ? null : (ot ?? ut);
  return {
    key: b.key,
    title: b.title,
    lastUpdate: date(b.last_update),
    homeSpread: hs,
    awaySpread: as,
    homeSpreadPrice: hs === null ? null : num(h.price),
    awaySpreadPrice: as === null ? null : num(a.price),
    total,
    overPrice: total === null ? null : num(over.price),
    underPrice: total === null ? null : num(under.price),
    homeMoneyline: num(outcome('h2h', home).price),
    awayMoneyline: num(outcome('h2h', away).price),
  };
}
export function normalizeOdds(raw: unknown): NFLGame[] {
  if (!Array.isArray(raw)) throw new Error('Malformed odds response');
  return raw
    .flatMap((value) => {
      const g = obj(value),
        kickoff = date(g.commence_time);
      if (
        typeof g.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(g.id) ||
        typeof g.home_team !== 'string' ||
        typeof g.away_team !== 'string' ||
        !kickoff ||
        g.sport_key !== 'americanfootball_nfl'
      )
        return [];
      const books = arr(g.bookmakers)
        .map((b) =>
          normalizeBook(b, g.home_team as string, g.away_team as string),
        )
        .filter((b): b is SportsbookOdds => b !== null);
      const sportsbooks = [...new Map(books.map((b) => [b.key, b])).values()];
      return [
        {
          id: g.id,
          sportKey: 'americanfootball_nfl' as const,
          commenceTime: kickoff,
          homeTeam: g.home_team,
          awayTeam: g.away_team,
          season: null,
          week: null,
          market: {
            consensusSpread: consensusSpread(sportsbooks),
            consensusTotal: median(sportsbooks.map((b) => b.total)),
            sportsbooks,
            bookmakerCount: sportsbooks.length,
            spreadBookCount: sportsbooks.filter((b) => b.homeSpread !== null)
              .length,
          },
        },
      ];
    })
    .sort((a, b) => a.commenceTime.localeCompare(b.commenceTime));
}
