import { explainForBeginners } from '../../lib/openai.js';
import { ensureUserRecord, getSubscriptionState, logUsage } from '../../lib/supabase.js';
import { corsHeaders, jsonResponse } from './_http.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handler(event: any) {
  const headers = corsHeaders(event.headers?.origin, 'POST, OPTIONS');

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, { ...headers, Allow: 'POST' });
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { content, userId, email } = body as {
      content?: string;
      userId?: string;
      email?: string;
    };

    if (!content || typeof content !== 'string' || !userId || typeof userId !== 'string') {
      return jsonResponse(400, { error: 'content and userId are required' }, headers);
    }

    if (!UUID_RE.test(userId)) {
      return jsonResponse(400, { error: 'Invalid userId format' }, headers);
    }

    if (email && (typeof email !== 'string' || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return jsonResponse(400, { error: 'Invalid email format' }, headers);
    }

    await ensureUserRecord(userId, email);

    const subscriptionState = await getSubscriptionState(userId);
    if (!subscriptionState.isPremium && subscriptionState.usesToday >= 5) {
      return jsonResponse(
        402,
        {
          error: 'Free usage limit reached',
          isPremium: false,
          usesToday: subscriptionState.usesToday,
          upgradeRequired: true
        },
        headers
      );
    }

    const result = await explainForBeginners(content.slice(0, 8000));
    await logUsage(userId, 'explain_page');

    return jsonResponse(
      200,
      {
        explanation: result.explanation,
        tokens_used: result.tokensUsed,
        usesToday: subscriptionState.usesToday + 1,
        isPremium: subscriptionState.isPremium
      },
      headers
    );
  } catch (error) {
    console.error('[explain] Internal error:', error);
    return jsonResponse(500, { error: 'An internal error occurred. Please try again later.' }, headers);
  }
}
