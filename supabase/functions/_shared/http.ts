import { createClient } from '@supabase/supabase-js';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export function admin() {
  const url = Deno.env.get('SUPABASE_URL'),
    key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new HttpError(503, 'Data service is unavailable.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function serve(handler: (req: Request) => Promise<unknown>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    const requestId = crypto.randomUUID();
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
      const data = await handler(req);
      return Response.json(data, {
        headers: { ...cors, 'X-Request-Id': requestId },
      });
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      // Never log upstream response bodies or URLs: they may contain credentials.
      console.error(
        JSON.stringify({
          requestId,
          status,
          type: err instanceof Error ? err.name : 'UnknownError',
        }),
      );
      return Response.json(
        {
          error:
            err instanceof HttpError
              ? err.message
              : 'Data service is unavailable. Please try again.',
          requestId,
        },
        { status, headers: cors },
      );
    }
  });
}
export async function gameId(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, 'A game ID is required.');
  }
  if (
    !body ||
    typeof body.id !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(body.id)
  )
    throw new HttpError(400, 'Invalid game ID.');
  return body.id as string;
}
export async function claim(key: string, seconds: number) {
  const { data, error } = await admin().rpc('claim_api_job', {
    job_key: key,
    hold_seconds: seconds,
  });
  if (error) throw error;
  return data === true;
}
export async function timedFetch(url: string | URL, init?: RequestInit) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(25000) });
  } catch {
    throw new HttpError(
      503,
      'The upstream provider did not respond. Try again shortly.',
    );
  }
}
