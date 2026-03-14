import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Simple query to confirm Supabase connection and read permissions
    const { data, error } = await supabaseAdmin.from('users').select('id').limit(1);
    if (error) {
      console.error('[ping] Supabase error:', error);
      return res.status(500).json({ ok: false, supabase: false, error: error.message });
    }

    return res.status(200).json({ ok: true, supabase: true, sampleCount: Array.isArray(data) ? data.length : 0 });
  } catch (err: any) {
    console.error('[ping] Unexpected error:', err);
    return res.status(500).json({ ok: false, supabase: false, error: String(err) });
  }
}
