export type AnalyticsEventName =
  | "onboarding_completed"
  | "chat_started"
  | "chat_starter_selected"
  | "chat_limit_hit"
  | "save_prompt_shown"
  | "close_intent_started"
  | "conversation_saved"
  | "journal_celebration_viewed"
  | "journal_saved_entry_opened"
  | "journal_post_save_new_reflection"
  | "journal_entry_viewed"
  | "journal_entry_export_cta_clicked"
  | "journal_entry_new_reflection_clicked"
  | "stats_viewed"
  | "stats_upgrade_clicked"
  | "stats_new_reflection_clicked"
  | "upgrade_page_viewed"
  | "upgrade_plan_toggled"
  | "upgrade_compare_clicked"
  | "upgrade_checkout_started"
  | "billing_portal_opened"
  | "journal_export_opened"
  | "journal_export_printed";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function sanitizeValue(value: unknown, depth = 0): JsonValue {
  if (depth > 3) {
    return "[truncated]";
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    if (typeof value === "string") {
      return value.slice(0, 500);
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) =>
      sanitizeValue(item, depth + 1)
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .slice(0, 20)
      .map(([key, val]) => [
        key.slice(0, 60),
        sanitizeValue(val, depth + 1),
      ]);

    return Object.fromEntries(entries);
  }

  return String(value).slice(0, 200);
}

export function sanitizeAnalyticsMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, JsonValue> {
  if (!metadata) {
    return {};
  }

  return sanitizeValue(metadata) as Record<string, JsonValue>;
}

export async function trackServerEvent(params: {
  supabase: any;
  userId: string;
  eventName: AnalyticsEventName;
  page?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const payload = {
    user_id: params.userId,
    event_name: params.eventName,
    page: params.page ?? null,
    metadata: sanitizeAnalyticsMetadata(params.metadata),
  };

  const { error } = await params.supabase
    .from("analytics_events")
    .insert([payload]);

  if (error) {
    throw error;
  }
}