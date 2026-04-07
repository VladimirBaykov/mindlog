export type PlanTier = "free" | "pro";

export type FeatureKey =
  | "saved_entries"
  | "weekly_summary"
  | "ai_insights"
  | "pdf_export";

export type ChatUsageLimits = {
  maxMessagesPerConversation: number;
  maxCharactersPerMessage: number;
  maxTotalInputCharacters: number;
};

export const FREE_JOURNAL_LIMIT = 20;

export function normalizePlan(
  value: string | null | undefined
): PlanTier {
  return value === "pro" ? "pro" : "free";
}

export function getJournalLimit(plan: PlanTier): number | null {
  return plan === "pro" ? null : FREE_JOURNAL_LIMIT;
}

export function getChatUsageLimits(
  plan: PlanTier
): ChatUsageLimits {
  if (plan === "pro") {
    return {
      maxMessagesPerConversation: 40,
      maxCharactersPerMessage: 4000,
      maxTotalInputCharacters: 24000,
    };
  }

  return {
    maxMessagesPerConversation: 16,
    maxCharactersPerMessage: 1200,
    maxTotalInputCharacters: 8000,
  };
}

export function hasFeatureAccess(
  plan: PlanTier,
  feature: FeatureKey
): boolean {
  if (plan === "pro") return true;

  switch (feature) {
    case "saved_entries":
      return true;
    case "weekly_summary":
      return false;
    case "ai_insights":
      return false;
    case "pdf_export":
      return false;
    default:
      return false;
  }
}

export function getPlanFromStripePriceId(
  priceId: string | null | undefined
): PlanTier {
  const monthly = process.env.STRIPE_PRICE_PRO_MONTHLY;
  const yearly = process.env.STRIPE_PRICE_PRO_YEARLY;

  if (priceId && (priceId === monthly || priceId === yearly)) {
    return "pro";
  }

  return "free";
}