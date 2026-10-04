create table public.games (
  id uuid primary key default gen_random_uuid(),
  external_game_id text not null unique,
  sport_key text not null default 'americanfootball_nfl' check (sport_key = 'americanfootball_nfl'),
  season integer, week integer check (week > 0),
  home_team text not null, away_team text not null,
  commence_time timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index games_commence_idx on public.games (commence_time);
create table public.odds_snapshots (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  bookmaker_key text not null, bookmaker_name text not null,
  home_spread numeric, home_spread_price integer, away_spread numeric, away_spread_price integer,
  total numeric, over_price integer, under_price integer, home_moneyline integer, away_moneyline integer,
  bookmaker_last_update timestamptz, captured_at timestamptz not null, created_at timestamptz not null default now(),
  unique (game_id, captured_at, bookmaker_key),
  check (home_spread is null or away_spread is null or home_spread = -away_spread)
);
create index odds_book_history_idx on public.odds_snapshots (game_id, bookmaker_key, captured_at desc);
create index odds_capture_idx on public.odds_snapshots (captured_at);
create table public.weather_snapshots (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  temperature_f numeric, wind_speed_mph numeric check (wind_speed_mph >= 0), wind_gust_mph numeric check (wind_gust_mph >= 0),
  precipitation_probability numeric check (precipitation_probability between 0 and 100),
  humidity numeric check (humidity between 0 and 100), conditions text,
  forecast_for timestamptz not null, captured_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index weather_game_time_idx on public.weather_snapshots (game_id, captured_at desc);
create table public.injuries (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  team text not null, external_player_id text, player_name text not null, position text, status text not null,
  injury text, practice_status text, impact_score numeric,
  source_updated_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index injuries_game_idx on public.injuries (game_id);
create table public.game_analyses (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  model text not null, analysis_version text not null,
  lean text not null check (lean in ('HOME','AWAY','PASS','INSUFFICIENT_DATA')),
  confidence numeric not null check (confidence between 0 and 100), summary text not null,
  market_analysis text not null, weather_analysis text, injury_analysis text,
  key_factors jsonb not null, risk_factors jsonb not null, input_snapshot jsonb not null, result jsonb not null,
  created_at timestamptz not null default now()
);
create index analyses_game_time_idx on public.game_analyses (game_id, created_at desc);
create table public.api_cache (key text primary key, payload jsonb not null, updated_at timestamptz not null default now());
create table public.api_jobs (key text primary key, next_allowed_at timestamptz not null);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger games_updated before update on public.games for each row execute function public.touch_updated_at();
create trigger injuries_updated before update on public.injuries for each row execute function public.touch_updated_at();

-- Shared, atomic budget gate. Only server-role callers may acquire a lease.
create function public.claim_api_job(job_key text, hold_seconds integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare claimed text;
begin
  insert into public.api_jobs (key, next_allowed_at) values (job_key, now() + make_interval(secs => hold_seconds))
  on conflict (key) do update set next_allowed_at = excluded.next_allowed_at
  where public.api_jobs.next_allowed_at <= now()
  returning key into claimed;
  return claimed is not null;
end;
$$;

-- One transaction per sync; each observed market has a complete set of books.
-- Identical fetch timestamps are idempotent. New observations preserve history.
create function public.store_odds_sync(games_payload jsonb, capture_time timestamptz) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare g jsonb; b jsonb; gid uuid; n integer := 0; count_games integer := 0; inserted integer;
begin
  perform pg_advisory_xact_lock(7264192);
  for g in select value from jsonb_array_elements(games_payload) loop
    insert into public.games(external_game_id,sport_key,home_team,away_team,commence_time)
    values(g->>'id',g->>'sportKey',g->>'homeTeam',g->>'awayTeam',(g->>'commenceTime')::timestamptz)
    on conflict(external_game_id) do update set home_team=excluded.home_team,away_team=excluded.away_team,commence_time=excluded.commence_time
    returning id into gid;
    count_games := count_games + 1;
    for b in select value from jsonb_array_elements(g->'market'->'sportsbooks') loop
      insert into public.odds_snapshots(game_id,bookmaker_key,bookmaker_name,home_spread,home_spread_price,away_spread,away_spread_price,total,over_price,under_price,home_moneyline,away_moneyline,bookmaker_last_update,captured_at)
      values(gid,b->>'key',b->>'title',(b->>'homeSpread')::numeric,(b->>'homeSpreadPrice')::integer,(b->>'awaySpread')::numeric,(b->>'awaySpreadPrice')::integer,(b->>'total')::numeric,(b->>'overPrice')::integer,(b->>'underPrice')::integer,(b->>'homeMoneyline')::integer,(b->>'awayMoneyline')::integer,(b->>'lastUpdate')::timestamptz,capture_time)
      on conflict(game_id,captured_at,bookmaker_key) do nothing;
      get diagnostics inserted = row_count;
      n := n + inserted;
    end loop;
  end loop;
  return jsonb_build_object('games',count_games,'snapshotsInserted',n);
end;
$$;

alter table public.games enable row level security;
alter table public.odds_snapshots enable row level security;
alter table public.weather_snapshots enable row level security;
alter table public.injuries enable row level security;
alter table public.game_analyses enable row level security;
alter table public.api_cache enable row level security;
alter table public.api_jobs enable row level security;

-- Market observations are public, but clients can never write them.
revoke all on public.games,public.odds_snapshots,public.weather_snapshots,public.injuries,public.game_analyses,public.api_cache,public.api_jobs from anon,authenticated;
grant select on public.games,public.odds_snapshots,public.weather_snapshots,public.injuries to anon,authenticated;
create policy market_read on public.games for select to anon,authenticated using (true);
create policy snapshots_read on public.odds_snapshots for select to anon,authenticated using (true);
create policy weather_read on public.weather_snapshots for select to anon,authenticated using (true);
create policy injuries_read on public.injuries for select to anon,authenticated using (true);
-- Analyses and their exact inputs are served only through the bounded Edge Function.
grant all on public.games,public.odds_snapshots,public.weather_snapshots,public.injuries,public.game_analyses,public.api_cache,public.api_jobs to service_role;
grant usage,select on all sequences in schema public to service_role;
revoke all on function public.claim_api_job(text,integer),public.store_odds_sync(jsonb,timestamptz),public.touch_updated_at() from public,anon,authenticated;
grant execute on function public.claim_api_job(text,integer),public.store_odds_sync(jsonb,timestamptz) to service_role;
