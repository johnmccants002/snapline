import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<unknown>),
  currentOdds: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('../supabase/functions/_shared/http.ts', () => ({
  serve: (handler: (req: Request) => Promise<unknown>) => {
    mocks.handler = handler;
  },
  admin: () => ({ rpc: mocks.rpc }),
  HttpError: class extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock('../supabase/functions/_shared/odds.ts', () => ({
  currentOdds: mocks.currentOdds,
}));
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('Deno', {
    env: {
      get: (key: string) =>
        key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-service-key' : undefined,
    },
  });
  await import('../supabase/functions/sync-odds/index');
});
it('rejects public sync before contacting the provider', async () => {
  await expect(
    mocks.handler!(new Request('https://test/sync', { method: 'POST' })),
  ).rejects.toMatchObject({ status: 403 });
  expect(mocks.currentOdds).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('does not store a stale fallback as a new observation', async () => {
  mocks.currentOdds.mockResolvedValue({
    games: [],
    fetchedAt: '2026-01-01',
    stale: true,
  });
  await expect(
    mocks.handler!(
      new Request('https://test/sync', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-service-key' },
      }),
    ),
  ).rejects.toMatchObject({ status: 503 });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('passes normalized games and original observation time to the transaction', async () => {
  const data = { games: [], fetchedAt: '2026-01-01T12:00:00Z', stale: false };
  mocks.currentOdds.mockResolvedValue(data);
  mocks.rpc.mockResolvedValue({
    data: { games: 0, snapshotsInserted: 0 },
    error: null,
  });
  await expect(
    mocks.handler!(
      new Request('https://test/sync', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-service-key' },
      }),
    ),
  ).resolves.toMatchObject({
    snapshotsInserted: 0,
    capturedAt: data.fetchedAt,
  });
  expect(mocks.rpc).toHaveBeenCalledWith('store_odds_sync', {
    games_payload: [],
    capture_time: data.fetchedAt,
  });
});
