import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export function getUtcDayRange() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

export async function ensureUserRecord(userId: string, email?: string | null) {
  if (!email) {
    return;
  }

  const { error } = await supabaseAdmin.from('users').upsert(
    {
      id: userId,
      email
    },
    {
      onConflict: 'id'
    }
  );

  if (error) {
    throw error;
  }
}

export async function getSubscriptionState(userId: string) {
  const [{ data: subscriptionRows, error: subscriptionError }, { count, error: usageError }] = await Promise.all([
    supabaseAdmin
      .from('subscriptions')
      .select('plan, status, stripe_customer_id, stripe_subscription_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabaseAdmin
      .from('usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('feature_used', 'explain_page')
      .gte('created_at', getUtcDayRange().start)
      .lt('created_at', getUtcDayRange().end)
  ]);

  if (subscriptionError) {
    throw subscriptionError;
  }

  if (usageError) {
    throw usageError;
  }

  const subscription = subscriptionRows?.[0] ?? null;
  const isPremium = Boolean(subscription && subscription.plan !== 'free' && subscription.status === 'active');

  return {
    subscription,
    isPremium,
    plan: subscription?.plan ?? 'free',
    usesToday: count ?? 0
  };
}

export async function logUsage(userId: string, featureUsed: string) {
  const { error } = await supabaseAdmin.from('usage_logs').insert({
    user_id: userId,
    feature_used: featureUsed
  });

  if (error) {
    throw error;
  }
}

export async function upsertSubscriptionRecord(input: {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  plan: string;
  status: string;
}) {
  const existingBySubscriptionId = input.stripeSubscriptionId
    ? await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', input.stripeSubscriptionId)
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };

  if (existingBySubscriptionId.error) {
    throw existingBySubscriptionId.error;
  }

  const targetId = existingBySubscriptionId.data?.id;

  if (targetId) {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        stripe_customer_id: input.stripeCustomerId ?? null,
        stripe_subscription_id: input.stripeSubscriptionId ?? null,
        plan: input.plan,
        status: input.status
      })
      .eq('id', targetId);

    if (error) {
      throw error;
    }

    return;
  }

  const { data: existingByUser, error: existingByUserError } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('user_id', input.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingByUserError) {
    throw existingByUserError;
  }

  if (existingByUser?.id) {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        stripe_customer_id: input.stripeCustomerId ?? null,
        stripe_subscription_id: input.stripeSubscriptionId ?? null,
        plan: input.plan,
        status: input.status
      })
      .eq('id', existingByUser.id);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabaseAdmin.from('subscriptions').insert({
    user_id: input.userId,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_subscription_id: input.stripeSubscriptionId ?? null,
    plan: input.plan,
    status: input.status
  });

  if (error) {
    throw error;
  }
}