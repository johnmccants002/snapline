export function median(values: unknown[]): number | null {
  const numbers = values
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!numbers.length) return null;
  const mid = Math.floor(numbers.length / 2);
  const result =
    numbers.length % 2 ? numbers[mid] : (numbers[mid - 1] + numbers[mid]) / 2;
  return Object.is(result, -0) ? 0 : result;
}
export function consensusSpread(books: unknown): number | null {
  if (!Array.isArray(books)) return null;
  return median(
    books.map((book) =>
      book && typeof book === 'object' ? book.homeSpread : null,
    ),
  );
}
export function signed(value: number | null): string {
  return value === null
    ? 'Unavailable'
    : value === 0
      ? 'PK'
      : value > 0
        ? `+${value}`
        : String(value);
}
