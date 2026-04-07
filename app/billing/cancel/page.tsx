"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";

type SubscriptionInfo = {
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  isPro: boolean;
} | null;

export default function BillingCancelPage() {
  const router = useRouter();
  const { setHeader, resetHeader } = useHeader();

  const [subscription, setSubscription] =
    useState<SubscriptionInfo>(null);
  const [loadingSubscription, setLoadingSubscription] =
    useState(true);

  useEffect(() => {
    setHeader({
      title: "Checkout canceled",
      leftSlot: (
        <button
          onClick={() => router.push("/upgrade")}
          className="text-sm text-neutral-400 hover:text-white transition"
        >
          ← Upgrade
        </button>
      ),
    });

    return () => resetHeader();
  }, [router, setHeader, resetHeader]);

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

  const isPro = subscription?.isPro ?? false;

  return (
    <AuthGate>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 pt-24 pb-24 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg">
              ↺
            </div>

            <h1 className="mt-4 text-2xl font-semibold text-white">
              Checkout canceled
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
              No payment was completed in Stripe, so nothing changed on
              your account.
            </p>

            <div className="mx-auto mt-5 max-w-md rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4 text-left">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                  Current plan
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300 capitalize">
                  {loadingSubscription
                    ? "loading"
                    : isPro
                    ? "pro"
                    : "free"}
                </span>
              </div>

              <p className="mt-3 text-sm text-neutral-300">
                Status: {loadingSubscription
                  ? "checking"
                  : subscription?.status || "inactive"}
              </p>

              {subscription?.currentPeriodEnd && (
                <p className="mt-2 text-xs text-neutral-500">
                  Current period ends{" "}
                  {new Date(
                    subscription.currentPeriodEnd
                  ).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={() => router.push("/upgrade")}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Back to upgrade
              </button>

              <button
                onClick={() => router.push("/profile")}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
              >
                Go to profile
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="text-sm font-medium text-white">
              What this means
            </div>

            <div className="mt-4 space-y-3 text-sm leading-relaxed text-neutral-400">
              <p>
                Your current plan stays exactly the same.
              </p>
              <p>
                You can return to Stripe Checkout anytime if you still
                want to upgrade.
              </p>
              <p>
                If you already had Pro before opening checkout, your
                current subscription remains active.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}