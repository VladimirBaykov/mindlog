export const FREE_JOURNAL_LIMIT = 20;

export type PlanTier = "free" | "pro";

export function getCurrentPlan(): PlanTier {
  return "free";
}