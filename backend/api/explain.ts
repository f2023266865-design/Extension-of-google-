import type { VercelRequest, VercelResponse } from '@vercel/node';

import { explainForBeginners } from '../lib/openai.js';
import { ensureUserRecord, getSubscriptionState, logUsage } from '../lib/supabase.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);

function setCorsHeaders(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { content, userId, email } = req.body as {
      content?: string;
      userId?: string;
      email?: string;
    };

    if (!content || typeof content !== 'string' || !userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'content and userId are required' });
    }

    if (!UUID_RE.test(userId)) {
      return res.status(400).json({ error: 'Invalid userId format' });
    }

    if (email && (typeof email !== 'string' || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    await ensureUserRecord(userId, email);

    const subscriptionState = await getSubscriptionState(userId);
    if (!subscriptionState.isPremium && subscriptionState.usesToday >= 5) {
      return res.status(402).json({
        error: 'Free usage limit reached',
        isPremium: false,
        usesToday: subscriptionState.usesToday,
        upgradeRequired: true
      });
    }

    const result = await explainForBeginners(content.slice(0, 8000));
    await logUsage(userId, 'explain_page');

    return res.status(200).json({
      explanation: result.explanation,
      tokens_used: result.tokensUsed,
      usesToday: subscriptionState.usesToday + 1,
      isPremium: subscriptionState.isPremium
    });
  } catch (error) {
    console.error('[explain] Internal error:', error);
    return res.status(500).json({
      error: 'An internal error occurred. Please try again later.'
    });
  }
}