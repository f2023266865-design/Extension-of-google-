import { ensureUserRecord, getSubscriptionState } from '../../lib/supabase.js';
import { stripe } from '../../lib/stripe.js';
import { corsHeaders, jsonResponse } from './_http.js';

const priceId = process.env.STRIPE_PRICE_ID;
const appUrl = process.env.APP_URL ?? 'https://example.com';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handler(event: any) {
  const headers = corsHeaders(event.headers?.origin, 'GET, POST, OPTIONS');

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      const userId = event.queryStringParameters?.userId;
      if (typeof userId !== 'string' || !UUID_RE.test(userId)) {
        return jsonResponse(400, { error: 'Valid userId is required' }, headers);
      }

      const state = await getSubscriptionState(userId);
      return jsonResponse(
        200,
        {
          isPremium: state.isPremium,
          plan: state.plan,
          usesToday: state.usesToday
        },
        headers
      );
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const { userId, email } = body as { userId?: string; email?: string };

      if (!userId || typeof userId !== 'string' || !UUID_RE.test(userId)) {
        return jsonResponse(400, { error: 'Valid userId is required' }, headers);
      }

      if (!email || typeof email !== 'string' || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse(400, { error: 'Valid email is required' }, headers);
      }

      if (!priceId) {
        return jsonResponse(500, { error: 'Service configuration error. Please contact support.' }, headers);
      }

      await ensureUserRecord(userId, email);
      const state = await getSubscriptionState(userId);

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        billing_address_collection: 'auto',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}?checkout=success`,
        cancel_url: `${appUrl}?checkout=cancelled`,
        customer_email: email,
        metadata: {
          userId,
          currentPlan: state.plan
        }
      });

      return jsonResponse(200, { checkoutUrl: checkoutSession.url }, headers);
    }

    return jsonResponse(405, { error: 'Method not allowed' }, { ...headers, Allow: 'GET, POST' });
  } catch (error) {
    console.error('[subscription] Internal error:', error);
    return jsonResponse(500, { error: 'An internal error occurred. Please try again later.' }, headers);
  }
}
