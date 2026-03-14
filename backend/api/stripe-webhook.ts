import type { VercelRequest, VercelResponse } from '@vercel/node';

import { stripe } from '../lib/stripe.js';
import { upsertSubscriptionRecord } from '../lib/supabase.js';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(req: VercelRequest) {
  const chunks: Uint8Array[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!webhookSecret) {
    console.error('[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Service configuration error' });
  }

  try {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    const rawBody = await readRawBody(req);
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

        if (userId) {
          await upsertSubscriptionRecord({
            userId,
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
            stripeSubscriptionId: subscriptionId,
            plan: 'premium',
            status: 'active'
          });
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;
        if (userId) {
          await upsertSubscriptionRecord({
            userId,
            stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null,
            stripeSubscriptionId: subscription.id,
            plan: subscription.status === 'active' ? 'premium' : 'free',
            status: subscription.status
          });
        }
        break;
      }

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[stripe-webhook] Error:', error);
    return res.status(400).json({
      error: 'Webhook processing failed'
    });
  }
}