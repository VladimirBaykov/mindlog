import {
  normalizePlan,
  getPlanFromStripePriceId,
} from "@/lib/plans";

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
  plan: "free" | "pro";
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  isPro: boolean;
};

function mapStripeStatusToAppStatus(status: string | null | undefined) {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "canceled":
      return "canceled";
    case "incomplete":
      return "incomplete";
    case "incomplete_expired":
      return "expired";
    case "paused":
      return "paused";
    default:
      return status || "inactive";
  }
}

function shouldTreatAsPro(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

async function fetchSubscriptionRow(
  supabase: any,
  userId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as SubscriptionRow | null) ?? null;
}

export async function ensureSubscriptionRow(
  supabase: any,
  userId: string
): Promise<SubscriptionRow> {
  const existing = await fetchSubscriptionRow(supabase, userId);

  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
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

  if (!error && data) {
    return data as SubscriptionRow;
  }

  const duplicateInsert =
    error?.code === "23505" ||
    String(error?.message || "")
      .toLowerCase()
      .includes("duplicate");

  if (duplicateInsert) {
    const afterRace = await fetchSubscriptionRow(supabase, userId);

    if (afterRace) {
      return afterRace;
    }
  }

  throw error;
}

export async function resolveUserSubscription(
  supabase: any,
  userId: string
): Promise<ResolvedSubscription> {
  const row = await ensureSubscriptionRow(supabase, userId);

  const plan = normalizePlan(row.plan);
  const status = row.status ?? "inactive";
  const isPro = plan === "pro" && status === "active";

  return {
    plan,
    status,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    currentPeriodEnd: row.current_period_end,
    isPro,
  };
}

export async function setStripeCustomerId(
  supabase: any,
  userId: string,
  stripeCustomerId: string
) {
  const { error } = await supabase
    .from("subscriptions")
    .update({
      stripe_customer_id: stripeCustomerId,
    })
    .eq("user_id", userId);

  if (error) throw error;
}

export async function findUserIdByStripeCustomerId(
  supabase: any,
  stripeCustomerId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.user_id ?? null;
}

export async function findUserIdByStripeSubscriptionId(
  supabase: any,
  stripeSubscriptionId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.user_id ?? null;
}

export async function syncSubscriptionFromStripe(
  supabase: any,
  params: {
    userId: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    status: string;
    currentPeriodEnd: number | null;
    priceId: string | null;
  }
) {
  const normalizedStatus = mapStripeStatusToAppStatus(
    params.status
  );

  const plan = shouldTreatAsPro(params.status)
    ? getPlanFromStripePriceId(params.priceId)
    : "free";

  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      [
        {
          user_id: params.userId,
          plan,
          status: normalizedStatus,
          stripe_customer_id: params.stripeCustomerId,
          stripe_subscription_id: params.stripeSubscriptionId,
          current_period_end: params.currentPeriodEnd
            ? new Date(
                params.currentPeriodEnd * 1000
              ).toISOString()
            : null,
        },
      ],
      {
        onConflict: "user_id",
      }
    );

  if (error) throw error;
}

export async function markSubscriptionCanceled(
  supabase: any,
  stripeSubscriptionId: string
) {
  const { error } = await supabase
    .from("subscriptions")
    .update({
      plan: "free",
      status: "canceled",
      current_period_end: null,
    })
    .eq("stripe_subscription_id", stripeSubscriptionId);

  if (error) throw error;
}