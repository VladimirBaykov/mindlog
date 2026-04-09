"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";
import { trackClientEvent } from "@/lib/analytics-client";

type SubscriptionInfo = {
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  isPro: boolean;
} | null;

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

type BillingInterval = "monthly" | "yearly";

export default function UpgradePage() {
  const router = useRouter();
  const { setHeader, resetHeader } = useHeader();

  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingSubscription, setLoadingSubscription] =
    useState(true);
  const [loadingUsage, setLoadingUsage] = useState(true);

  const [subscription, setSubscription] =
    useState<SubscriptionInfo>(null);
  const [usage, setUsage] = useState<UsageInfo>(null);
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");
  const [viewTracked, setViewTracked] = useState(false);

  useEffect(() => {
    setHeader({
      title: "Upgrade to Pro",
      leftSlot: (
        <button
          onClick={() => router.push("/profile")}
          className="text-sm text-neutral-400 hover:text-white transition"
        >
          ← Profile
        </button>
      ),
      menuItems: [
        {
          label: "Journal",
          onClick: () => router.push("/journal"),
        },
        {
          label: "Stats",
          onClick: () => router.push("/stats"),
        },
      ],
    });

    return () => resetHeader();
  }, [router, resetHeader, setHeader]);

  async function loadSubscription() {
    try {
      setLoadingSubscription(true);

      const res = await fetch("/api/account/subscription", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to load subscription");
      }

      const data = await res.json();
      setSubscription(data);
    } catch (error) {
      console.error("Subscription load failed:", error);
      setSubscription(null);
    } finally {
      setLoadingSubscription(false);
    }
  }

  async function loadUsage() {
    try {
      setLoadingUsage(true);

      const res = await fetch("/api/account/usage", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to load usage");
      }

      const data = await res.json();
      setUsage(data);
    } catch (error) {
      console.error("Usage load failed:", error);
      setUsage(null);
    } finally {
      setLoadingUsage(false);
    }
  }

  useEffect(() => {
    loadSubscription();
    loadUsage();
  }, []);

  useEffect(() => {
    if (viewTracked) return;
    if (loadingSubscription || loadingUsage) return;

    setViewTracked(true);

    trackClientEvent({
      eventName: "upgrade_page_viewed",
      page: "/upgrade",
      metadata: {
        currentPlan: subscription?.isPro ? "pro" : "free",
        currentStatus: subscription?.status || "inactive",
        used: usage?.used ?? null,
        limit: usage?.limit ?? null,
        remaining: usage?.remaining ?? null,
      },
    });
  }, [
    viewTracked,
    loadingSubscription,
    loadingUsage,
    subscription,
    usage,
  ]);

  async function handleCheckout(source = "primary_cta") {
    try {
      setLoadingCheckout(true);

      await trackClientEvent({
        eventName: "upgrade_checkout_started",
        page: "/upgrade",
        metadata: {
          source,
          interval: billingInterval,
          currentPlan: subscription?.isPro ? "pro" : "free",
          currentStatus: subscription?.status || "inactive",
          used: usage?.used ?? null,
          remaining: usage?.remaining ?? null,
        },
      });

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          interval: billingInterval,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Checkout failed");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Checkout failed");
    } finally {
      setLoadingCheckout(false);
    }
  }

  async function handlePortal() {
    try {
      setLoadingPortal(true);

      await trackClientEvent({
        eventName: "billing_portal_opened",
        page: "/upgrade",
        metadata: {
          from: "upgrade_page",
          currentPlan: subscription?.isPro ? "pro" : "free",
          currentStatus: subscription?.status || "inactive",
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

  async function handlePlanToggle(next: BillingInterval) {
    setBillingInterval(next);

    await trackClientEvent({
      eventName: "upgrade_plan_toggled",
      page: "/upgrade",
      metadata: {
        interval: next,
        currentPlan: subscription?.isPro ? "pro" : "free",
        currentStatus: subscription?.status || "inactive",
      },
    });
  }

  async function handleCompareClick(section: string) {
    await trackClientEvent({
      eventName: "upgrade_compare_clicked",
      page: "/upgrade",
      metadata: {
        section,
        interval: billingInterval,
        currentPlan: subscription?.isPro ? "pro" : "free",
        used: usage?.used ?? null,
        remaining: usage?.remaining ?? null,
      },
    });
  }

  const isPro = subscription?.isPro ?? false;

  const priceLabel = useMemo(() => {
    return billingInterval === "monthly"
      ? "$9.99 / month"
      : "$79.99 / year";
  }, [billingInterval]);

  const priceNote = useMemo(() => {
    return billingInterval === "monthly"
      ? "Best for getting started with premium reflections."
      : "Best value if you plan to use MindLog long term.";
  }, [billingInterval]);

  const whyNowCopy = useMemo(() => {
    if (usage?.limit === null) {
      return "You already use MindLog deeply. Pro helps turn your reflection habit into a stronger long-term system.";
    }

    if (typeof usage?.remaining === "number" && usage.remaining <= 0) {
      return "You’ve reached your current free save limit. Pro removes the cap and lets your journal keep growing.";
    }

    if (typeof usage?.remaining === "number" && usage.remaining <= 2) {
      return `You only have ${usage.remaining} free save${
        usage.remaining === 1 ? "" : "s"
      } left. Upgrading now keeps your momentum uninterrupted.`;
    }

    return "Pro is most valuable once you start building real journal history, because that’s when patterns, summaries, and exports start to matter.";
  }, [usage]);

  const checkoutTrustCopy = useMemo(() => {
    if (isPro) {
      return "Your Pro plan is already active. You can review or manage billing at any time.";
    }

    return "You’ll be taken to real Stripe Checkout. After payment succeeds, MindLog activates Pro automatically when the Stripe webhook sync completes.";
  }, [isPro]);

  return (
    <AuthGate>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 pt-24 pb-24 space-y-6">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] px-5 py-6">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-300">
              MindLog Pro
            </div>

            <h1 className="mt-4 text-3xl font-semibold text-white">
              Go deeper with your reflections
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-neutral-300">
              Pro is designed for people who want more depth, more
              insight, and a more complete personal reflection
              experience.
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-1">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => handlePlanToggle("monthly")}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                    billingInterval === "monthly"
                      ? "bg-white text-black"
                      : "bg-transparent text-neutral-300 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  Monthly
                </button>

                <button
                  type="button"
                  onClick={() => handlePlanToggle("yearly")}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                    billingInterval === "yearly"
                      ? "bg-white text-black"
                      : "bg-transparent text-neutral-300 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  Yearly
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                    Selected plan
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {priceLabel}
                  </div>
                </div>

                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300 capitalize">
                  {loadingSubscription
                    ? "loading"
                    : isPro
                    ? "pro active"
                    : "free"}
                </div>
              </div>

              <p className="mt-3 text-sm text-neutral-400">
                {priceNote}
              </p>

              {subscription?.currentPeriodEnd && isPro && (
                <p className="mt-3 text-xs text-neutral-500">
                  Current billing period ends{" "}
                  {new Date(
                    subscription.currentPeriodEnd
                  ).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-sm font-medium text-white">
                Why upgrading matters now
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                {whyNowCopy}
              </p>

              {usage && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                    <div className="text-xs text-neutral-500">
                      Saved entries
                    </div>
                    <div className="mt-2 text-xl font-semibold text-white">
                      {usage.used}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                    <div className="text-xs text-neutral-500">
                      Free limit
                    </div>
                    <div className="mt-2 text-xl font-semibold text-white">
                      {usage.limit ?? "∞"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                    <div className="text-xs text-neutral-500">
                      Remaining
                    </div>
                    <div className="mt-2 text-xl font-semibold text-white">
                      {usage.remaining ?? "∞"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {!isPro ? (
                <button
                  onClick={() => handleCheckout("hero_cta")}
                  disabled={loadingCheckout}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
                >
                  {loadingCheckout
                    ? "Preparing checkout..."
                    : billingInterval === "monthly"
                    ? "Continue to monthly checkout"
                    : "Continue to yearly checkout"}
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
                onClick={() => {
                  loadSubscription();
                  loadUsage();
                }}
                disabled={loadingSubscription || loadingUsage}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05] disabled:opacity-50"
              >
                {loadingSubscription || loadingUsage
                  ? "Refreshing..."
                  : "Refresh plan status"}
              </button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-neutral-400">
              {checkoutTrustCopy}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="text-sm font-medium text-white">
              Free vs Pro
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-sm font-medium text-white">
                  Free
                </div>
                <div className="mt-3 space-y-2 text-sm text-neutral-400">
                  <div>• Limited saved entries</div>
                  <div>• Reduced AI depth</div>
                  <div>• No weekly summary</div>
                  <div>• No AI insights</div>
                  <div>• No PDF export</div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">
                    Pro
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-200">
                    Recommended
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-sm text-neutral-300">
                  <div>• Unlimited saved entries</div>
                  <div>• Deeper AI reflection depth</div>
                  <div>• Weekly reflection summary</div>
                  <div>• Premium AI pattern insights</div>
                  <div>• Exportable reflection reports</div>
                </div>
              </div>
            </div>

            {!isPro && (
              <button
                onClick={async () => {
                  await handleCompareClick("comparison_block");
                  await handleCheckout("comparison_block");
                }}
                disabled={loadingCheckout}
                className="mt-5 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
              >
                Choose Pro
              </button>
            )}
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-sm font-medium text-white">
                Unlimited saved entries
              </div>
              <p className="mt-2 text-sm text-neutral-400">
                Keep your full journal history without free plan limits.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-sm font-medium text-white">
                Weekly reflection summary
              </div>
              <p className="mt-2 text-sm text-neutral-400">
                Unlock richer 7-day summaries based on your recent
                emotional patterns and recurring themes.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-sm font-medium text-white">
                Premium AI insights
              </div>
              <p className="mt-2 text-sm text-neutral-400">
                Get stronger pattern detection, more helpful reflective
                guidance, and deeper emotional signals.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-sm font-medium text-white">
                Exportable reflection reports
              </div>
              <p className="mt-2 text-sm text-neutral-400">
                Save your progress as polished reports and take your
                reflections with you.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4">
            <div className="text-sm font-medium text-white">
              Billing clarity
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Real billing is handled by Stripe. You can manage your
              subscription later from MindLog profile or billing portal.
              Pro access unlocks automatically after Stripe sync
              completes.
            </p>
          </div>

          {!isPro && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
              <div className="text-sm font-medium text-white">
                Still deciding?
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                The more your journal becomes part of your routine, the
                more valuable unlimited history, summaries, exports, and
                deeper insight become.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => handleCheckout("bottom_cta")}
                  disabled={loadingCheckout}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
                >
                  {loadingCheckout ? "Preparing..." : "Upgrade now"}
                </button>

                <button
                  onClick={async () => {
                    await handleCompareClick("return_to_stats");
                    router.push("/stats");
                  }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
                >
                  Back to stats
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGate>
  );
}