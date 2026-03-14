import { supabaseAdmin } from '../../lib/supabase.js';
import { corsHeaders, jsonResponse } from './_http.js';

export async function handler(event: any) {
  const headers = corsHeaders(event.headers?.origin, 'GET, OPTIONS');

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' }, { ...headers, Allow: 'GET' });
  }

  try {
    const { data, error } = await supabaseAdmin.from('users').select('id').limit(1);
    if (error) {
      console.error('[ping] Supabase error:', error);
      return jsonResponse(500, { ok: false, supabase: false, error: error.message }, headers);
    }

    return jsonResponse(
      200,
      { ok: true, supabase: true, sampleCount: Array.isArray(data) ? data.length : 0 },
      headers
    );
  } catch (err: any) {
    console.error('[ping] Unexpected error:', err);
    return jsonResponse(500, { ok: false, supabase: false, error: String(err) }, headers);
  }
}
