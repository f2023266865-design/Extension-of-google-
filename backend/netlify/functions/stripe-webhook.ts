import { stripe } from '../../lib/stripe.js';
import { upsertSubscriptionRecord } from '../../lib/supabase.js';
import { jsonResponse } from './_http.js';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, { Allow: 'POST' });
  }

  if (!webhookSecret) {
    console.error('[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET');
    return jsonResponse(500, { error: 'Service configuration error' });
  }

  try {
    const signature = event.headers?.['stripe-signature'] ?? event.headers?.['Stripe-Signature'];
    if (typeof signature !== 'string') {
      return jsonResponse(400, { error: 'Missing Stripe signature' });
    }

    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64')
      : Buffer.from(event.body ?? '', 'utf8');

    const stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
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
        const subscription = stripeEvent.data.object;
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

    return jsonResponse(200, { received: true });
  } catch (error) {
    console.error('[stripe-webhook] Error:', error);
    return jsonResponse(400, { error: 'Webhook processing failed' });
  }
}
