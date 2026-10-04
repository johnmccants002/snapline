# Snapline

Understand the NFL market. An Expo / React Native research app with live sportsbook comparison, median consensus, stored line history, and evidence-grounded AI explanations. PASS is a first-class result; no picks engine or invented model is included.

## Architecture

```text
Expo Router + TanStack Query
  → nfl-odds Edge Function → The Odds API → normalized games
  → public read-only Postgres tables → consensus line history
  → analyze-game Edge Function → OpenAI Structured Outputs → saved analysis + exact inputs
Admin CLI / future scheduler
  → sync-odds Edge Function → transactional game upsert + append-only snapshots
```

The client imports only domain types and pure calculations from `supabase/functions/_shared`. Provider payloads stay behind the normalization boundary. Every spread is the **home team's handicap**: negative = home favorite, positive = home underdog, zero = pick'em. Totals and spreads use the median of finite reporting values. A single book is labeled as limited consensus.

## Prerequisites

- Node 24 LTS and npm (minimum Node 22.13)
- A Supabase project and The Odds API key with NFL access
- Expo Go compatible with SDK 57, or an iOS/Android development build
- Docker for the optional local Supabase stack; Xcode/Android Studio for simulators
- An OpenAI API key only if enabling analysis

## Install and configure Expo

```sh
npm ci
```

Create `.env.local` with **only**:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

`.env.example` lists every supported variable with empty values. Do not copy server secrets into any `EXPO_PUBLIC_*` variable. No login UI is required.

## Supabase setup and migrations

Use a new or designated project. The migration adds `games`, `odds_snapshots`, `weather_snapshots`, `injuries`, `game_analyses`, plus internal cache/lease tables. RLS is enabled everywhere. Client roles can read public market context but cannot write, acquire leases, or inspect internal AI inputs. The service role handles server writes.

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

For CI, use a scoped `SUPABASE_ACCESS_TOKEN`. Review the migration before applying it to any existing shared database.

Create a gitignored `.env.providers` file:

```dotenv
ODDS_API_KEY=YOUR_ODDS_API_KEY
SYNC_SECRET=YOUR_RANDOM_64_CHARACTER_HEX_SECRET
# Optional:
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-4.1-mini
```

```sh
npx supabase secrets set --env-file .env.providers
npx supabase functions deploy nfl-odds sync-odds analyze-game --use-api
```

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions. Do not upload these reserved names with `secrets set`. `WEATHER_API_KEY` and `INJURY_API_KEY` are reserved for future adapters; setting them alone does not enable an integration.

The function configuration intentionally disables gateway JWT checks: reads and analysis are public, protected by database-backed cost gates. `sync-odds` additionally enforces a dedicated `x-sync-secret` header inside its handler. CORS allows web and native clients. Public keys are identification, not an authorization boundary.

## Run the app

```sh
npm start
# Or
npm run web
npm run ios
npm run android
```

Restart Expo after changing public environment values. Home loads real NFL odds from the Edge Function; game detail shows each bookmaker, total, and stored consensus history. Pull down to refresh. The client and server use a 60-second market cache; the UI labels delayed responses. If the upstream fails, a cached observation can be served for up to 15 minutes, visibly marked stale. Stale responses cannot be synced or analyzed.

## Capture snapshots manually

Create a separate, gitignored `.env.server` for the local administrator script:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SYNC_SECRET=THE_SAME_SYNC_SECRET_FROM_ENV_PROVIDERS
```

```sh
npm run sync:odds
```

Run again after at least one minute to collect a distinct observation. Generate the sync secret with `openssl rand -hex 32`, store it in both server files, and deploy it with the provider secrets. The script prints game and inserted snapshot counts. Every sync writes a complete sportsbook set with a shared observation timestamp, transactionally. Repeating the same cached observation inserts nothing. New observations are preserved even when prices are unchanged, allowing accurate market coverage over time. The SQL function serializes concurrent sync writes.

Line history shows median consensus per stored observation for the last seven days. It does not reconstruct a historical opener, infer values before collection, or carry missing books forward. The chart labels the first observed line explicitly. A future scheduler can POST to `sync-odds` using a server-held sync secret; no schedule is installed by this repository.

## AI analysis

Set `OPENAI_API_KEY`, deploy `analyze-game`, and tap **Analyze game**. The server gathers current normalized odds and stored history, and supplies explicit unavailable states for weather, injuries, and the quantitative model. OpenAI uses a strict JSON schema; the result is validated again with Zod and confidence is clamped to 0–100. Refusals, incomplete output, and schema failures return useful errors.

Every saved row preserves the exact structured input, model, analysis version, timestamp, and validated output. Confidence is labeled as qualitative assessment strength, **not a calibrated win probability**. Analyses are cached for ten minutes per game; paid attempts are bounded to one per game per ten minutes and one globally per twenty seconds. A failed attempt also consumes that lease. Set provider-side spending limits appropriate to your deployment. Before broad public distribution, add per-user/device abuse controls; the initial shared gates bound spend but can be exhausted by another caller.

## Local Supabase (optional)

With Docker running:

```sh
npx supabase start
npx supabase db reset
npx supabase functions serve --env-file .env.providers
```

Use the local API URL and public key reported by `supabase status` in `.env.local`; use the same sync secret in `.env.server`. Android emulator access normally requires `10.0.2.2` in place of localhost; a physical phone needs a reachable LAN address. The functions receive local server credentials automatically.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run test:db
npm run check:edge
npm run format:check
npx expo export --platform web
```

`test:db` applies the real migration to an ephemeral PGlite PostgreSQL instance and verifies snapshot idempotency, append-only behavior, budget gates, RLS, public reads, and denied client writes. It does not replace a hosted Supabase integration check. Tests use clearly isolated synthetic fixtures; the app never displays fixture data. CI runs these checks and exports the web bundle.

Live verification checklist after configuring credentials:

1. Load home and compare a game's bookmaker lines with the provider response.
2. Open details and verify home/away orientation and missing market states.
3. Run two syncs at least a minute apart, then refresh the line chart.
4. Enable OpenAI, request analysis, and inspect the saved `input_snapshot` in Supabase Studio.
5. Confirm provider errors display correctly and no server keys appear in the client bundle.

## Current limitations and next integrations

- NFL only. The odds endpoint returns currently listed markets, not an official schedule. Season/week and venue are not supplied, so the app does not guess them.
- Weather and injury provider contracts and tables exist, but adapters and read integration are intentionally not connected. No invented injury impacts or weather values.
- No quantitative model, estimated fair spread, payments, subscriptions, auth UI, props, parlays, or bet slips.
- History requires administrator syncs. It is bounded to seven days / 50,000 rows per game; increase or aggregate server-side for heavier collection.
- Analysis retrieval is through the endpoint and uses a ten-minute cache. Refreshing may return a prior timestamp.
- Next: official schedule/stadium metadata, weather adapter, injury adapter with source timestamps, scheduled sync, monitoring, and a separately evaluated quantitative model.

## Integration references

- [The Odds API v4](https://the-odds-api.com/liveapi/guides/v4/)
- [Supabase Edge Function security](https://supabase.com/docs/guides/functions/auth)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

### Dependency audit note

The initial audit reports two unpatched upstream advisories in Expo's build-tool dependency tree: `braces` (GHSA-vfj7-8cjw-p6xm) and `node-forge` (GHSA-86w9-cpqp-85rv), propagated to 19 high-severity package entries. Compatible automatic fixes do not resolve them; the registry currently has no patched release for either root package. Do not use `npm audit fix --force`, which proposes an incompatible Expo downgrade. Available fixes for `decode-uri-component` and `xcode`'s `uuid` are pinned through overrides. Recheck the upstream advisories before release.
