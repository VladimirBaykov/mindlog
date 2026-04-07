"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";

type SubscriptionInfo = {
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  isPro: boolean;
} | null;

type BillingInterval = "monthly" | "yearly";

export default function UpgradePage() {
  const router = useRouter();
  const { setHeader, resetHeader } = useHeader();

  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingSubscription, setLoadingSubscription] =
    useState(true);
  const [subscription, setSubscription] =
    useState<SubscriptionInfo>(null);
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");

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

  useEffect(() => {
    loadSubscription();
  }, []);

  async function handleCheckout() {
    try {
      setLoadingCheckout(true);

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
                  onClick={() => setBillingInterval("monthly")}
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
                  onClick={() => setBillingInterval("yearly")}
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

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {!isPro ? (
                <button
                  onClick={handleCheckout}
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
                  {loadingPortal
                    ? "Opening..."
                    : "Manage billing"}
                </button>
              )}

              <button
                onClick={loadSubscription}
                disabled={loadingSubscription}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05] disabled:opacity-50"
              >
                {loadingSubscription
                  ? "Refreshing..."
                  : "Refresh plan status"}
              </button>
            </div>

            {isPro ? (
              <p className="mt-4 text-sm leading-relaxed text-neutral-400">
                Your Pro plan is already active. You can manage your
                subscription from here or from your profile.
              </p>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-neutral-400">
                You’ll be taken to real Stripe Checkout. After payment,
                MindLog will activate Pro automatically when the webhook
                sync completes.
              </p>
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
              Billing status
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {isPro
                ? "Your account already has Pro access. Use billing management if you want to review or change your subscription."
                : "This flow uses real Stripe checkout. If Stripe payment succeeds, your subscription status will sync into Supabase and unlock Pro features across the app."}
            </p>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}