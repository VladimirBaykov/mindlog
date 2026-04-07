import type { AnalyticsEventName } from "@/lib/analytics";

export async function trackClientEvent(params: {
  eventName: AnalyticsEventName;
  page?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await fetch("/api/analytics/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventName: params.eventName,
        page: params.page,
        metadata: params.metadata ?? {},
      }),
      keepalive: true,
    });
  } catch (error) {
    console.error("Analytics track failed:", error);
  }
}