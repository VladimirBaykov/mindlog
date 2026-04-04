import { normalizePlan, type PlanTier } from "@/lib/plans";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type ResolvedSubscription = {
  plan: PlanTier;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  isPro: boolean;
};

export async function ensureSubscriptionRow(
  supabase: any,
  userId: string
): Promise<SubscriptionRow | null> {
  const { data: existing, error: existingError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing as SubscriptionRow;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("subscriptions")
    .insert([
      {
        user_id: userId,
        plan: "free",
        status: "inactive",
      },
    ])
    .select("*")
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted as SubscriptionRow;
}

export async function resolveUserSubscription(
  supabase: any,
  userId: string
): Promise<ResolvedSubscription> {
  const row = await ensureSubscriptionRow(supabase, userId);

  const plan = normalizePlan(row?.plan);
  const status = row?.status ?? "inactive";

  return {
    plan,
    status,
    stripeCustomerId: row?.stripe_customer_id ?? null,
    stripeSubscriptionId: row?.stripe_subscription_id ?? null,
    currentPeriodEnd: row?.current_period_end ?? null,
    isPro: plan === "pro" && status === "active",
  };
}