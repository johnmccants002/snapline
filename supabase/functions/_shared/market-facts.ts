import type { LinePoint } from './domain.ts';

export interface MarketEvidence {
  consensusSpread: number | null;
  sportsbooks: { key: string; homeSpread: number | null }[];
}
const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

// Counts alone never establish agreement. Conflicting duplicate books are omitted.
export function marketNarrative(market: MarketEvidence, points: LinePoint[]) {
  const books = new Map<string, Set<number>>();
  for (const book of market.sportsbooks) {
    if (
      !book.key ||
      book.homeSpread === null ||
      !Number.isFinite(book.homeSpread)
    )
      continue;
    const lines = books.get(book.key) ?? new Set<number>();
    lines.add(book.homeSpread);
    books.set(book.key, lines);
  }
  const quotes = [...books.values()]
    .filter((lines) => lines.size === 1)
    .map((lines) => [...lines][0]);
  const distinct = new Set(quotes);
  const agreement =
    quotes.length < 2
      ? `Only ${quotes.length} usable distinct sportsbook spread quote(s) are available; bookmaker agreement cannot be established.`
      : distinct.size === 1
        ? `All ${quotes.length} usable distinct sportsbook quotes have the same home spread of ${signed(quotes[0])}.`
        : `${quotes.length} usable distinct sportsbook quotes differ, ranging from ${signed(Math.min(...quotes))} to ${signed(Math.max(...quotes))} for the home spread.`;

  // Repeated or conflicting observations at one timestamp do not create history.
  const times = new Map<number, Set<number>>();
  for (const point of points) {
    const time = Date.parse(point.capturedAt);
    if (
      !Number.isFinite(time) ||
      !Number.isFinite(point.homeSpread) ||
      point.bookCount < 1
    )
      continue;
    const values = times.get(time) ?? new Set<number>();
    values.add(point.homeSpread);
    times.set(time, values);
  }
  const history = [...times]
    .filter(([, values]) => values.size === 1)
    .sort(([a], [b]) => a - b)
    .map(([time, values]) => ({ time, spread: [...values][0] }));
  let movement =
    'Fewer than two usable stored observations are available; line movement is unknown.';
  if (history.length >= 2) {
    const first = history[0],
      last = history[history.length - 1];
    const delta = Number((last.spread - first.spread).toFixed(6));
    const varied = history.some((point) => point.spread !== first.spread);
    movement =
      `${history.length} stored observations from ${new Date(first.time).toISOString()} to ${new Date(last.time).toISOString()}: home consensus ${signed(first.spread)} to ${signed(last.spread)}, net change ${signed(delta)} points. ` +
      (varied
        ? 'The spread changed within the observed samples.'
        : 'The spread was unchanged across these samples; changes between samples are unknown.') +
      ' The first observation is not a verified opening line; bookmaker composition can change between samples.';
  }
  const spread = market.consensusSpread;
  const usable = spread !== null && Number.isFinite(spread);
  const position = !usable
    ? 'No usable current home spread is available.'
    : spread === 0
      ? 'The current home consensus spread is 0 (pick’em).'
      : `The current home consensus spread is ${signed(spread)} (home ${spread < 0 ? 'favorite' : 'underdog'}).`;
  return {
    summary: `${position} ${usable ? 'PASS: market observations alone do not establish a directional betting advantage.' : 'INSUFFICIENT_DATA: a usable spread is required.'}`,
    marketAnalysis: `${position} ${agreement} ${movement} Neither agreement nor movement alone establishes an advantage against the spread.`,
  };
}
