"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";
import { supabase } from "@/lib/supabase-browser";
import { trackClientEvent } from "@/lib/analytics-client";
import {
  fetchAccountSnapshot,
  type SubscriptionInfo,
  type UsageInfo,
} from "@/lib/account-client";

type UserInfo = {
  email: string | null;
  id: string | null;
};

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

  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [subscription, setSubscription] =
    useState<SubscriptionInfo | null>(null);

  const [loadingAccount, setLoadingAccount] = useState(true);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [refreshingPlan, setRefreshingPlan] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewTracked, setViewTracked] = useState(false);

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

  async function loadUser(signal?: AbortSignal) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (signal?.aborted) return;

    setUserInfo({
      email: user?.email ?? null,
      id: user?.id ?? null,
    });

    const email = user?.email?.toLowerCase() || "";
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    setIsAdmin(Boolean(email && adminEmails.includes(email)));

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

  async function loadAccountState(options?: {
    signal?: AbortSignal;
    refresh?: boolean;
  }) {
    const signal = options?.signal;
    const refresh = options?.refresh ?? false;

    try {
      if (refresh) {
        setRefreshingPlan(true);
      } else {
        setLoadingAccount(true);
      }

      const snapshot = await fetchAccountSnapshot(signal);

      if (signal?.aborted) return;

      setUsage(snapshot.usage);
      setSubscription(snapshot.subscription);
    } catch (err) {
      if (signal?.aborted) return;
      console.error("Account snapshot load failed:", err);
    } finally {
      if (signal?.aborted) return;

      if (refresh) {
        setRefreshingPlan(false);
      } else {
        setLoadingAccount(false);
      }
    }
  }

  const isPro = subscription?.isPro ?? false;

  async function refreshPlanStatus(source = "manual_refresh") {
    await trackClientEvent({
      eventName: "profile_refresh_plan_clicked",
      page: "/profile",
      metadata: {
        source,
        currentPlan: subscription?.plan ?? null,
        currentStatus: subscription?.status ?? null,
        used: usage?.used ?? null,
        remaining: usage?.remaining ?? null,
      },
    });

    await loadAccountState({ refresh: true });
  }

  async function handlePortal(source = "billing_card") {
    try {
      setLoadingPortal(true);

      await trackClientEvent({
        eventName: "profile_billing_clicked",
        page: "/profile",
        metadata: {
          source,
          currentPlan: subscription?.plan ?? null,
          currentStatus: subscription?.status ?? null,
        },
      });

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
          label: refreshingPlan ? "Refreshing..." : "Refresh plan status",
          highlight: true,
          onClick: () => refreshPlanStatus("header_menu"),
        },
        ...(isPro
          ? [
              {
                label: loadingPortal ? "Opening..." : "Manage billing",
                onClick: () => handlePortal("header_menu"),
              },
            ]
          : []),
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
  }, [
    router,
    resetHeader,
    setHeader,
    refreshingPlan,
    loadingPortal,
    isPro,
    subscription?.plan,
    subscription?.status,
    usage?.used,
    usage?.remaining,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    loadUser(controller.signal);
    loadAccountState({ signal: controller.signal });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (viewTracked) return;
    if (loadingAccount) return;

    setViewTracked(true);

    trackClientEvent({
      eventName: "profile_viewed",
      page: "/profile",
      metadata: {
        currentPlan: subscription?.plan ?? null,
        currentStatus: subscription?.status ?? null,
        used: usage?.used ?? null,
        remaining: usage?.remaining ?? null,
      },
    });
  }, [viewTracked, loadingAccount, subscription, usage]);

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

      await trackClientEvent({
        eventName: "profile_onboarding_restart_clicked",
        page: "/profile",
        metadata: {
          currentPlan: subscription?.plan ?? null,
          currentStatus: subscription?.status ?? null,
        },
      });

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

  const accountHealthCopy = useMemo(() => {
    if (loadingAccount) {
      return "Loading account health...";
    }

    if (isPro && subscription?.status === "active") {
      return "Your account is in a healthy state. Pro access is active and billing looks good.";
    }

    if (
      !isPro &&
      typeof usage?.remaining === "number" &&
      usage.remaining <= 0
    ) {
      return "You’ve reached the free save limit. Upgrading now is the cleanest way to keep your reflection momentum going.";
    }

    if (
      !isPro &&
      typeof usage?.remaining === "number" &&
      usage.remaining <= 2
    ) {
      return `You only have ${usage.remaining} free save${
        usage.remaining === 1 ? "" : "s"
      } left.`;
    }

    if (
      subscription?.status === "past_due" ||
      subscription?.status === "unpaid"
    ) {
      return "Your account needs billing attention before Pro access can feel stable again.";
    }

    return "Your account is ready to keep growing with more reflections.";
  }, [loadingAccount, usage, subscription, isPro]);

  const planValueCopy = useMemo(() => {
    if (isPro) {
      return "Unlimited history, deeper AI reflection, weekly summaries, premium insights, and export are available on your account.";
    }

    return "You can keep using MindLog on free, but Pro is where the journal starts feeling cumulative rather than capped.";
  }, [isPro]);

  return (
    <AuthGate>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 pt-8 pb-24 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="text-xs text-neutral-500">
              Signed in as
            </div>
            <div className="mt-2 break-all text-base font-medium text-white">
              {userInfo.email || "Loading..."}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="text-sm font-medium text-white">
              Account health
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {accountHealthCopy}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs text-neutral-500">Plan</div>
                <div className="mt-2 text-lg font-semibold capitalize text-white">
                  {subscription?.plan || "free"}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs text-neutral-500">
                  Billing status
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {subscription?.status || "inactive"}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs text-neutral-500">
                  Saved entries
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {usage?.used ?? "—"}
                </div>
              </div>
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

            <p className="mt-4 text-sm leading-relaxed text-neutral-400">
              {planValueCopy}
            </p>

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
                  onClick={async () => {
                    await trackClientEvent({
                      eventName: "profile_upgrade_clicked",
                      page: "/profile",
                      metadata: {
                        source: "plan_card",
                        currentPlan: subscription?.plan ?? null,
                        currentStatus: subscription?.status ?? null,
                        used: usage?.used ?? null,
                        remaining: usage?.remaining ?? null,
                      },
                    });

                    router.push("/upgrade");
                  }}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
                >
                  Upgrade to Pro
                </button>
              ) : (
                <button
                  onClick={() => handlePortal("plan_card")}
                  disabled={loadingPortal}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
                >
                  {loadingPortal ? "Opening..." : "Manage billing"}
                </button>
              )}

              <button
                onClick={() => refreshPlanStatus("plan_card")}
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
                onClick={() => refreshPlanStatus("billing_state_card")}
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
                  onClick={() => handlePortal("billing_state_card")}
                  disabled={loadingPortal}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
                >
                  {loadingPortal ? "Opening..." : "Open billing"}
                </button>
              )}
            </div>
          </div>

          {!isPro && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
              <div className="text-sm font-medium text-white">
                Why Pro may be worth it now
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                {typeof usage?.remaining === "number" &&
                usage.remaining <= 2
                  ? "You are close to the free save limit. Pro keeps your momentum uninterrupted and unlocks the deeper product layer."
                  : "Once your journal starts becoming a habit, unlimited history, summaries, premium insights, and export become much more meaningful."}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-sm font-medium text-white">
                    Unlimited journal growth
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                    Keep building history without worrying about save
                    caps.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-sm font-medium text-white">
                    Richer reflection layer
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                    Unlock summaries, insights, export, and deeper AI
                    use.
                  </p>
                </div>
              </div>

              <button
                onClick={async () => {
                  await trackClientEvent({
                    eventName: "profile_upgrade_clicked",
                    page: "/profile",
                    metadata: {
                      source: "why_pro_card",
                      currentPlan: subscription?.plan ?? null,
                      currentStatus: subscription?.status ?? null,
                      used: usage?.used ?? null,
                      remaining: usage?.remaining ?? null,
                    },
                  });

                  router.push("/upgrade");
                }}
                className="mt-5 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                View Pro plan
              </button>
            </div>
          )}

          {isAdmin && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
              <div className="text-sm font-medium text-white">
                Admin tools
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                Internal visibility for analytics, billing states, launch
                readiness, feedback prep, and product activity.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => router.push("/debug")}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
                >
                  Open debug metrics
                </button>

                <button
                  onClick={() => router.push("/launch-checklist")}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
                >
                  Open launch checklist
                </button>

                <button
                  onClick={() => router.push("/feedback")}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
                >
                  Open feedback prep
                </button>
              </div>
            </div>
          )}

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
              Legal and support
            </div>

            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Important launch basics for users, billing questions, policy
              access, and early support readiness.
            </p>

            <div className="mt-4 space-y-3">
              <Link
                href="/privacy"
                className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5 text-left text-sm text-neutral-200 transition hover:bg-white/[0.04]"
              >
                <span>Privacy Policy</span>
                <span className="text-neutral-500">→</span>
              </Link>

              <Link
                href="/terms"
                className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5 text-left text-sm text-neutral-200 transition hover:bg-white/[0.04]"
              >
                <span>Terms of Service</span>
                <span className="text-neutral-500">→</span>
              </Link>

              <Link
                href="/support"
                className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5 text-left text-sm text-neutral-200 transition hover:bg-white/[0.04]"
              >
                <span>Support</span>
                <span className="text-neutral-500">→</span>
              </Link>

              <Link
                href="/feedback"
                className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5 text-left text-sm text-neutral-200 transition hover:bg-white/[0.04]"
              >
                <span>Feedback prep</span>
                <span className="text-neutral-500">→</span>
              </Link>
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