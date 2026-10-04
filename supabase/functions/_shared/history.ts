import { median } from './consensus.ts';
import type { LinePoint } from './domain.ts';
export interface Snapshot {
  captured_at: string;
  bookmaker_key: string;
  home_spread: number | null;
}
// A sync writes all books with the same timestamp, so each point is a complete observed market.
export function buildHistory(rows: Snapshot[]): LinePoint[] {
  const buckets = new Map<string, Map<string, number | null>>();
  for (const row of rows) {
    const books =
      buckets.get(row.captured_at) ?? new Map<string, number | null>();
    books.set(row.bookmaker_key, row.home_spread);
    buckets.set(row.captured_at, books);
  }
  return [...buckets]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([capturedAt, books]) => {
      const values = [...books.values()].filter(
        (v): v is number => v !== null && Number.isFinite(v),
      );
      const homeSpread = median(values);
      return homeSpread === null
        ? []
        : [{ capturedAt, homeSpread, bookCount: values.length }];
    });
}
