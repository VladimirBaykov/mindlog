"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";
import { supabase } from "@/lib/supabase-browser";

type UserInfo = {
  email: string | null;
  id: string | null;
};

type UsageInfo = {
  plan: "free" | "pro";
  status?: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  canSave: boolean;
  currentPeriodEnd?: string | null;
  ai?: {
    maxMessagesPerConversation: number;
    maxCharactersPerMessage: number;
    maxTotalInputCharacters: number;
  };
} | null;

type SubscriptionInfo = {
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  isPro: boolean;
} | null;

type GoalOption =
  | "process_emotions"
  | "build_consistency"
  | "understand_patterns"
  | null;

type MoodOption =
  | "gentle"
  | "balanced"
  | "direct"
  | null;

type NotificationOption =
  | "yes"
  | "not_now"
  | null;

type PreferencesState = {
  onboardingCompleted: boolean;
  goal: GoalOption;
  moodPreference: MoodOption;
  notifications: NotificationOption;
};

const goalOptions: {
  value: Exclude<GoalOption, null>;
  title: string;
  description: string;
}[] = [
  {
    value: "process_emotions",
    title: "Process emotions",
    description:
      "Use MindLog as a calm space to unpack what you’re feeling.",
  },
  {
    value: "build_consistency",
    title: "Build consistency",
    description:
      "Create a simple reflective habit you can return to regularly.",
  },
  {
    value: "understand_patterns",
    title: "Understand patterns",
    description:
      "Notice emotional themes and recurring inner patterns over time.",
  },
];

const moodOptions: {
  value: Exclude<MoodOption, null>;
  title: string;
  description: string;
}[] = [
  {
    value: "gentle",
    title: "Gentle",
    description:
      "Softer reflective prompts and calmer conversational tone.",
  },
  {
    value: "balanced",
    title: "Balanced",
    description:
      "A neutral middle ground between support and clarity.",
  },
  {
    value: "direct",
    title: "Direct",
    description:
      "A slightly clearer, more focused reflective style.",
  },
];

const notificationOptions: {
  value: Exclude<NotificationOption, null>;
  title: string;
  description: string;
}[] = [
  {
    value: "yes",
    title: "Yes, later",
    description:
      "You’d like gentle reminders once notification settings exist.",
  },
  {
    value: "not_now",
    title: "Not now",
    description:
      "You want to keep the experience quiet for now.",
  },
];

export default function ProfilePage() {
  const router = useRouter();
  const { setHeader, resetHeader } = useHeader();

  const [userInfo, setUserInfo] = useState<UserInfo>({
    email: null,
    id: null,
  });

  const [usage, setUsage] = useState<UsageInfo>(null);
  const [subscription, setSubscription] =
    useState<SubscriptionInfo>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [refreshingPlan, setRefreshingPlan] = useState(false);

  const [preferences, setPreferences] =
    useState<PreferencesState>({
      onboardingCompleted: false,
      goal: null,
      moodPreference: null,
      notifications: null,
    });

  const [savingPreferences, setSavingPreferences] =
    useState(false);
  const [restartingOnboarding, setRestartingOnboarding] =
    useState(false);

  useEffect(() => {
    setHeader({
      title: "Profile",
      leftSlot: (
        <button
          onClick={() => router.push("/journal")}
          className="text-sm text-neutral-400 hover:text-white transition"
        >
          ← Journal
        </button>
      ),
      menuItems: [
        {
          label: "Stats",
          onClick: () => router.push("/stats"),
        },
        {
          label: "Upgrade",
          onClick: () => router.push("/upgrade"),
        },
        {
          label: "New conversation",
          onClick: () => router.push("/chat"),
        },
        {
          label: "Logout",
          danger: true,
          onClick: async () => {
            await supabase.auth.signOut();
            router.refresh();
            router.push("/sign-in");
          },
        },
      ],
    });

    return () => resetHeader();
  }, [router, resetHeader, setHeader]);

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUserInfo({
      email: user?.email ?? null,
      id: user?.id ?? null,
    });

    setPreferences({
      onboardingCompleted: Boolean(
        user?.user_metadata?.onboarding_completed
      ),
      goal:
        (user?.user_metadata
          ?.onboarding_goal as GoalOption) ?? null,
      moodPreference:
        (user?.user_metadata
          ?.onboarding_mood_preference as MoodOption) ?? null,
      notifications:
        (user?.user_metadata
          ?.onboarding_notifications as NotificationOption) ??
        null,
    });
  }

  async function loadUsage() {
    try {
      const res = await fetch("/api/account/usage", {
        cache: "no-store",
      });

      if (!res.ok) return;

      const data = await res.json();
      setUsage(data);
    } catch (err) {
      console.error("Usage load failed:", err);
    }
  }

  async function loadSubscription() {
    try {
      const res = await fetch("/api/account/subscription", {
        cache: "no-store",
      });

      if (!res.ok) return;

      const data = await res.json();
      setSubscription(data);
    } catch (err) {
      console.error("Subscription load failed:", err);
    }
  }

  async function refreshPlanStatus() {
    try {
      setRefreshingPlan(true);
      await Promise.all([loadUsage(), loadSubscription()]);
    } finally {
      setRefreshingPlan(false);
    }
  }

  useEffect(() => {
    loadUser();
    refreshPlanStatus();
  }, []);

  async function handlePortal() {
    try {
      setLoadingPortal(true);

      const res = await fetch("/api/billing/portal", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Portal failed");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Portal failed");
    } finally {
      setLoadingPortal(false);
    }
  }

  async function savePreferences() {
    if (savingPreferences) return;

    try {
      setSavingPreferences(true);

      const { error } = await supabase.auth.updateUser({
        data: {
          onboarding_completed:
            preferences.onboardingCompleted,
          onboarding_goal: preferences.goal,
          onboarding_mood_preference:
            preferences.moodPreference,
          onboarding_notifications:
            preferences.notifications,
        },
      });

      if (error) {
        throw error;
      }

      await loadUser();
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to save preferences");
    } finally {
      setSavingPreferences(false);
    }
  }

  async function restartOnboarding() {
    if (restartingOnboarding) return;

    try {
      setRestartingOnboarding(true);

      const { error } = await supabase.auth.updateUser({
        data: {
          onboarding_completed: false,
        },
      });

      if (error) {
        throw error;
      }

      router.push("/welcome");
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to restart onboarding");
    } finally {
      setRestartingOnboarding(false);
    }
  }

  const isPro = subscription?.isPro ?? false;

  const starterPreview = useMemo(() => {
    switch (preferences.goal) {
      case "process_emotions":
        return "I want to talk through what I’ve been feeling lately, because something feels emotionally heavy and I want to understand it more clearly.";
      case "build_consistency":
        return "I want to start a simple reflection habit, so help me begin with a calm check-in about how today has felt.";
      case "understand_patterns":
        return "I want to understand my recurring emotional patterns better, especially what keeps showing up in my thoughts and reactions.";
      default:
        return "Your onboarding starter will appear here once you choose a direction.";
    }
  }, [preferences.goal]);

  const billingSummary = useMemo(() => {
    const status = subscription?.status || "inactive";

    switch (status) {
      case "active":
        return {
          title: "Billing is healthy",
          description:
            "Your subscription is active and Pro access is currently unlocked.",
          tone: "ok",
        };
      case "past_due":
        return {
          title: "Payment issue detected",
          description:
            "Your subscription is still on record, but Stripe marked it as past due. Open billing to review payment details.",
          tone: "warn",
        };
      case "unpaid":
        return {
          title: "Subscription payment failed",
          description:
            "Stripe marked this subscription as unpaid. Billing management may be needed to restore full access.",
          tone: "warn",
        };
      case "canceled":
        return {
          title: "Subscription canceled",
          description:
            "Your subscription was canceled. Free plan remains available, and you can upgrade again anytime.",
          tone: "neutral",
        };
      case "paused":
        return {
          title: "Subscription paused",
          description:
            "Your billing record is paused right now. Review billing settings for the current subscription state.",
          tone: "neutral",
        };
      case "incomplete":
        return {
          title: "Checkout not fully completed",
          description:
            "A billing session may have started, but the subscription did not fully activate yet.",
          tone: "warn",
        };
      case "expired":
        return {
          title: "Subscription expired",
          description:
            "This subscription is no longer active. You can start a new upgrade flow anytime.",
          tone: "neutral",
        };
      default:
        return {
          title: "No active subscription",
          description:
            "You are currently on the free plan. Upgrade whenever you want deeper reflection features.",
          tone: "neutral",
        };
    }
  }, [subscription?.status]);

  const billingToneClasses =
    billingSummary.tone === "warn"
      ? "border-amber-500/20 bg-amber-500/10"
      : billingSummary.tone === "ok"
      ? "border-emerald-500/20 bg-emerald-500/10"
      : "border-white/10 bg-white/[0.03]";

  return (
    <AuthGate>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 pt-24 pb-24 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="text-xs text-neutral-500">
              Signed in as
            </div>
            <div className="mt-2 break-all text-base font-medium text-white">
              {userInfo.email || "Loading..."}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-white">
                  Plan
                </div>
                <div className="mt-2 text-base font-medium capitalize text-white">
                  {isPro ? "pro" : "free"} plan
                </div>
                <p className="mt-1 text-sm text-neutral-400">
                  {usage?.limit
                    ? `${usage.used}/${usage.limit} saved entries used`
                    : "Unlimited saved entries"}
                </p>
              </div>

              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300">
                {subscription?.status || "inactive"}
              </div>
            </div>

            {typeof usage?.remaining === "number" && (
              <p className="mt-3 text-xs text-neutral-500">
                {usage.remaining > 0
                  ? `${usage.remaining} saves remaining on your current plan.`
                  : "You’ve reached the current free plan limit."}
              </p>
            )}

            {subscription?.currentPeriodEnd && (
              <p className="mt-2 text-xs text-neutral-500">
                Current period ends:{" "}
                {new Date(
                  subscription.currentPeriodEnd
                ).toLocaleDateString()}
              </p>
            )}

            {usage?.ai && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                  AI depth
                </div>
                <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                  {usage.ai.maxMessagesPerConversation} messages per
                  conversation · up to{" "}
                  {usage.ai.maxCharactersPerMessage} characters per
                  message
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {!isPro ? (
                <button
                  onClick={() => router.push("/upgrade")}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
                >
                  Upgrade to Pro
                </button>
              ) : (
                <button
                  onClick={handlePortal}
                  disabled={loadingPortal}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
                >
                  {loadingPortal ? "Opening..." : "Manage billing"}
                </button>
              )}

              <button
                onClick={refreshPlanStatus}
                disabled={refreshingPlan}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05] disabled:opacity-50"
              >
                {refreshingPlan
                  ? "Refreshing..."
                  : "Refresh plan status"}
              </button>
            </div>

            {!isPro && (
              <p className="mt-3 text-xs text-neutral-500">
                If you’ve just completed checkout, use refresh after
                the Stripe webhook sync finishes.
              </p>
            )}
          </div>

          <div className={`rounded-3xl border px-5 py-5 ${billingToneClasses}`}>
            <div className="text-sm font-medium text-white">
              {billingSummary.title}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-300">
              {billingSummary.description}
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={refreshPlanStatus}
                disabled={refreshingPlan}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05] disabled:opacity-50"
              >
                {refreshingPlan
                  ? "Refreshing..."
                  : "Refresh billing state"}
              </button>

              {(subscription?.status === "past_due" ||
                subscription?.status === "unpaid" ||
                isPro) && (
                <button
                  onClick={handlePortal}
                  disabled={loadingPortal}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
                >
                  {loadingPortal ? "Opening..." : "Open billing"}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-white">
                  Reflection preferences
                </div>
                <p className="mt-1 text-sm text-neutral-400">
                  Update the same preferences you chose during
                  onboarding.
                </p>
              </div>

              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300">
                {preferences.onboardingCompleted
                  ? "completed"
                  : "incomplete"}
              </div>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                  What are you here for?
                </div>

                <div className="mt-3 space-y-2">
                  {goalOptions.map((option) => {
                    const selected =
                      preferences.goal === option.value;

                    return (
                      <button
                        key={option.value}
                        onClick={() =>
                          setPreferences((prev) => ({
                            ...prev,
                            goal: option.value,
                          }))
                        }
                        className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                          selected
                            ? "border-white/20 bg-white/[0.08]"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="text-sm font-medium text-white">
                          {option.title}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                  Preferred tone
                </div>

                <div className="mt-3 space-y-2">
                  {moodOptions.map((option) => {
                    const selected =
                      preferences.moodPreference ===
                      option.value;

                    return (
                      <button
                        key={option.value}
                        onClick={() =>
                          setPreferences((prev) => ({
                            ...prev,
                            moodPreference: option.value,
                          }))
                        }
                        className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                          selected
                            ? "border-white/20 bg-white/[0.08]"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="text-sm font-medium text-white">
                          {option.title}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                  Reminders later
                </div>

                <div className="mt-3 space-y-2">
                  {notificationOptions.map((option) => {
                    const selected =
                      preferences.notifications ===
                      option.value;

                    return (
                      <button
                        key={option.value}
                        onClick={() =>
                          setPreferences((prev) => ({
                            ...prev,
                            notifications: option.value,
                          }))
                        }
                        className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                          selected
                            ? "border-white/20 bg-white/[0.08]"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="text-sm font-medium text-white">
                          {option.title}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4">
                <div className="text-sm font-medium text-white">
                  Current starter preview
                </div>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                  {starterPreview}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={savePreferences}
                  disabled={savingPreferences}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
                >
                  {savingPreferences
                    ? "Saving..."
                    : "Save preferences"}
                </button>

                <button
                  onClick={restartOnboarding}
                  disabled={restartingOnboarding}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05] disabled:opacity-50"
                >
                  {restartingOnboarding
                    ? "Opening..."
                    : "Run onboarding again"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="text-sm font-medium text-white">
              Account
            </div>

            <div className="mt-4 space-y-3">
              <button
                onClick={() => router.push("/journal")}
                className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5 text-left text-sm text-neutral-200 transition hover:bg-white/[0.04]"
              >
                <span>Open Journal</span>
                <span className="text-neutral-500">→</span>
              </button>

              <button
                onClick={() => router.push("/stats")}
                className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5 text-left text-sm text-neutral-200 transition hover:bg-white/[0.04]"
              >
                <span>Reflection Stats</span>
                <span className="text-neutral-500">→</span>
              </button>

              <button
                onClick={() => router.push("/chat")}
                className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5 text-left text-sm text-neutral-200 transition hover:bg-white/[0.04]"
              >
                <span>New Conversation</span>
                <span className="text-neutral-500">→</span>
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="text-sm font-medium text-white">
              Session
            </div>

            <div className="mt-4">
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.refresh();
                  router.push("/sign-in");
                }}
                className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Logout
              </button>
            </div>
          </div>

          {userInfo.id && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
              <div className="text-xs text-neutral-500">
                User ID
              </div>
              <div className="mt-2 break-all text-xs text-neutral-400">
                {userInfo.id}
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGate>
  );
}