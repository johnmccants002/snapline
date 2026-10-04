const url = process.env.SUPABASE_URL;
const key = process.env.SYNC_SECRET;
if (!url || !key)
  throw new Error('Set SUPABASE_URL and SYNC_SECRET in .env.server.');
const response = await fetch(`${url}/functions/v1/sync-odds`, {
  method: 'POST',
  headers: {
    'x-sync-secret': key,
    'Content-Type': 'application/json',
  },
  body: '{}',
  signal: AbortSignal.timeout(60000),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error ?? 'Sync failed');
console.log(result);
