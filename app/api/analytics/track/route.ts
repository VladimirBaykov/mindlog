import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  trackServerEvent,
  type AnalyticsEventName,
} from "@/lib/analytics";

const allowedEvents = new Set<AnalyticsEventName>([
  "onboarding_completed",
  "chat_started",
  "chat_starter_selected",
  "chat_limit_hit",
  "save_prompt_shown",
  "close_intent_started",
  "conversation_saved",
  "journal_celebration_viewed",
  "journal_saved_entry_opened",
  "journal_post_save_new_reflection",
  "journal_entry_viewed",
  "journal_entry_export_cta_clicked",
  "journal_entry_new_reflection_clicked",
  "stats_viewed",
  "stats_upgrade_clicked",
  "stats_new_reflection_clicked",
  "upgrade_page_viewed",
  "upgrade_plan_toggled",
  "upgrade_compare_clicked",
  "upgrade_checkout_started",
  "billing_success_viewed",
  "billing_success_pro_confirmed",
  "billing_success_refresh_clicked",
  "billing_success_profile_clicked",
  "billing_success_start_reflection_clicked",
  "profile_viewed",
  "profile_refresh_plan_clicked",
  "profile_billing_clicked",
  "profile_upgrade_clicked",
  "profile_onboarding_restart_clicked",
  "billing_portal_opened",
  "journal_export_opened",
  "journal_export_printed",
]);

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingAnalyticsTableError(error: any) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();

  return (
    code === "PGRST205" ||
    (message.includes("analytics_events") &&
      message.includes("schema cache"))
  );
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const eventName = body?.eventName;
    const page =
      typeof body?.page === "string" ? body.page.slice(0, 120) : null;
    const metadata = isPlainObject(body?.metadata) ? body.metadata : {};

    if (
      typeof eventName !== "string" ||
      !allowedEvents.has(eventName as AnalyticsEventName)
    ) {
      return NextResponse.json(
        { error: "Invalid analytics event" },
        { status: 400 }
      );
    }

    try {
      await trackServerEvent({
        supabase,
        userId: user.id,
        eventName: eventName as AnalyticsEventName,
        page,
        metadata,
      });
    } catch (trackingError: any) {
      if (isMissingAnalyticsTableError(trackingError)) {
        console.warn(
          "Analytics table is not available yet. Skipping event:",
          eventName
        );

        return NextResponse.json({
          success: true,
          skipped: true,
          reason: "analytics_table_missing",
        });
      }

      throw trackingError;
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("ANALYTICS TRACK ERROR:", e);

    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}