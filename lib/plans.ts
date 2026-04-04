export type PlanTier = "free" | "pro";

export type FeatureKey =
  | "saved_entries"
  | "weekly_summary"
  | "ai_insights"
  | "pdf_export";

export const FREE_JOURNAL_LIMIT = 20;

export function normalizePlan(value: string | null | undefined): PlanTier {
  return value === "pro" ? "pro" : "free";
}

export function getJournalLimit(plan: PlanTier): number | null {
  return plan === "pro" ? null : FREE_JOURNAL_LIMIT;
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