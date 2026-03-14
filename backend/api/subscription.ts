import type { VercelRequest, VercelResponse } from '@vercel/node';

import { ensureUserRecord, getSubscriptionState } from '../lib/supabase.js';
import { stripe } from '../lib/stripe.js';

const priceId = process.env.STRIPE_PRICE_ID;
const appUrl = process.env.APP_URL ?? 'https://example.com';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);

function setCorsHeaders(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

  try {
    if (req.method === 'GET') {
      const userId = req.query.userId;

      if (typeof userId !== 'string' || !UUID_RE.test(userId)) {
        return res.status(400).json({ error: 'Valid userId is required' });
      }

      const state = await getSubscriptionState(userId);
      return res.status(200).json({
        isPremium: state.isPremium,
        plan: state.plan,
        usesToday: state.usesToday
      });
    }

    if (req.method === 'POST') {
      const { userId, email } = req.body as { userId?: string; email?: string };

      if (!userId || typeof userId !== 'string' || !UUID_RE.test(userId)) {
        return res.status(400).json({ error: 'Valid userId is required' });
      }

      if (!email || typeof email !== 'string' || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Valid email is required' });
      }

      if (!priceId) {
        return res.status(500).json({ error: 'Service configuration error. Please contact support.' });
      }

      await ensureUserRecord(userId, email);
      const state = await getSubscriptionState(userId);

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        billing_address_collection: 'auto',
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        success_url: `${appUrl}?checkout=success`,
        cancel_url: `${appUrl}?checkout=cancelled`,
        customer_email: email,
        metadata: {
          userId,
          currentPlan: state.plan
        }
      });

      return res.status(200).json({ checkoutUrl: checkoutSession.url });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[subscription] Internal error:', error);
    return res.status(500).json({
      error: 'An internal error occurred. Please try again later.'
    });
  }
}