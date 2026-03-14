import { createClient } from '@supabase/supabase-js';
import { corsHeaders, jsonResponse } from './_http.js';

export async function handler(event: any) {
  const headers = corsHeaders(event.headers?.origin, 'GET, OPTIONS');

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' }, { ...headers, Allow: 'GET' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse(
      503,
      {
        ok: false,
        supabase: false,
        configured: false,
        error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Netlify environment variables'
      },
      headers
    );
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

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
