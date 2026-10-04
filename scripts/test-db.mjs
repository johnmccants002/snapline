import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(
  'create role anon; create role authenticated; create role service_role bypassrls;',
);
for (const file of readdirSync('supabase/migrations').sort())
  await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
const payload = [
  {
    id: 'test',
    sportKey: 'americanfootball_nfl',
    homeTeam: 'Home',
    awayTeam: 'Away',
    commenceTime: '2026-10-04T17:00:00Z',
    market: {
      sportsbooks: [
        {
          key: 'one',
          title: 'One',
          homeSpread: -3,
          awaySpread: 3,
          homeSpreadPrice: -110,
        },
        { key: 'two', title: 'Two', homeSpread: -4, awaySpread: 4 },
      ],
    },
  },
];
await db.exec('set role service_role');
const sync = async (time) =>
  (
    await db.query(
      'select public.store_odds_sync($1::jsonb,$2::timestamptz) as result',
      [JSON.stringify(payload), time],
    )
  ).rows[0].result;
assert.equal((await sync('2026-10-01T12:00:00Z')).snapshotsInserted, 2);
assert.equal((await sync('2026-10-01T12:00:00Z')).snapshotsInserted, 0);
assert.equal((await sync('2026-10-01T12:02:00Z')).snapshotsInserted, 2);
assert.equal(
  (await db.query("select public.claim_api_job('test',60) as ok")).rows[0].ok,
  true,
);
assert.equal(
  (await db.query("select public.claim_api_job('test',60) as ok")).rows[0].ok,
  false,
);
await db.exec('set role anon');
assert.equal(
  (await db.query('select * from public.odds_snapshots')).rows.length,
  4,
);
await assert.rejects(
  () => db.exec('delete from public.games'),
  /permission denied/,
);
await assert.rejects(
  () => db.exec('select * from public.api_cache'),
  /permission denied/,
);
await assert.rejects(
  () => db.exec('select * from public.game_analyses'),
  /permission denied/,
);
await assert.rejects(
  () => db.exec("select public.claim_api_job('bad',1)"),
  /permission denied/,
);
await assert.rejects(
  () =>
    db.query('select public.store_odds_sync($1::jsonb,now())', [
      JSON.stringify(payload),
    ]),
  /permission denied/,
);
await db.exec('reset role');
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from pg_class where relnamespace='public'::regnamespace and relkind='r' and not relrowsecurity",
    )
  ).rows[0].n,
  0,
);
await db.close();
console.log(
  'Database passed: migration, append-only history, idempotency, budget gate, RLS and role permissions.',
);
