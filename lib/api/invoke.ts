import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabase } from '../supabase';
export async function invoke<T>(name: string, body = {}): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke<T>(name, {
    body,
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      let payload;
      try {
        payload = await error.context.json();
      } catch {
        /* Fall back to connection message. */
      }
      if (typeof payload?.error === 'string') throw new Error(payload.error);
    }
    throw new Error(
      'Unable to reach the data service. Check your connection and Supabase setup.',
    );
  }
  if (!data) throw new Error('The data service returned an empty response.');
  return data;
}
