"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";

type SubscriptionResponse = {
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  isPro: boolean;
};

type SyncState = "checking" | "active" | "pending" | "error";

export default function BillingSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setHeader, resetHeader } = useHeader();

  const [syncState, setSyncState] =
    useState<SyncState>("checking");
  const [subscription, setSubscription] =
    useState<SubscriptionResponse | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    setHeader({
      title: "Billing success",
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

  async function fetchSubscriptionStatus() {
    const res = await fetch("/api/account/subscription", {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("Failed to refresh subscription");
    }

    const data = (await res.json()) as SubscriptionResponse;
    setSubscription(data);

    if (data.isPro) {
      setSyncState("active");
      return true;
    }

    return false;
  }

  useEffect(() => {
    let cancelled = false;
    let intervalId: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    async function startPolling() {
      setSyncState("checking");

      try {
        const active = await fetchSubscriptionStatus();

        if (cancelled) return;

        if (active) {
          return;
        }

        intervalId = setInterval(async () => {
          try {
            setAttempts((prev) => prev + 1);
            const isActive = await fetchSubscriptionStatus();

            if (cancelled) return;

            if (isActive && intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          } catch (error) {
            console.error("Subscription polling failed:", error);
          }
        }, 2000);

        timeoutId = setTimeout(() => {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }

          if (!cancelled) {
            setSyncState((prev) =>
              prev === "active" ? prev : "pending"
            );
          }
        }, 16000);
      } catch (error) {
        console.error("Initial subscription check failed:", error);

        if (!cancelled) {
          setSyncState("error");
        }
      }
    }

    startPolling();

    return () => {
      cancelled = true;

      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  async function handleManualRefresh() {
    try {
      setRefreshing(true);
      setSyncState("checking");

      const active = await fetchSubscriptionStatus();

      if (!active) {
        setSyncState("pending");
      }
    } catch (error) {
      console.error(error);
      setSyncState("error");
    } finally {
      setRefreshing(false);
    }
  }

  const statusBlock = useMemo(() => {
    if (syncState === "active") {
      return {
        title: "Pro is active",
        description:
          "Your payment was completed and your subscription has been synced successfully. Pro features are now unlocked on your account.",
      };
    }

    if (syncState === "pending") {
      return {
        title: "Payment completed, sync still pending",
        description:
          "Stripe checkout completed successfully, but your Pro status has not appeared yet. This usually means the webhook is still syncing your subscription.",
      };
    }

    if (syncState === "error") {
      return {
        title: "Couldn’t confirm subscription yet",
        description:
          "The payment flow completed, but we couldn’t verify your latest subscription status right now. Try refreshing your plan status in a moment.",
      };
    }

    return {
      title: "Checking your subscription",
      description:
        "Stripe checkout completed. We’re now checking whether the webhook has already activated your Pro plan.",
    };
  }, [syncState]);

  return (
    <AuthGate>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 pt-24 pb-24">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg">
              {syncState === "active" ? "✓" : "…" }
            </div>

            <h1 className="mt-4 text-2xl font-semibold text-white">
              {statusBlock.title}
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
              {statusBlock.description}
            </p>

            {sessionId && (
              <p className="mt-3 break-all text-xs text-neutral-500">
                Session: {sessionId}
              </p>
            )}

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4 text-left">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                  Current plan
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300 capitalize">
                  {subscription?.isPro ? "pro" : "free"}
                </span>
              </div>

              <p className="mt-3 text-sm text-neutral-300">
                Status: {subscription?.status || "checking"}
              </p>

              {subscription?.currentPeriodEnd && (
                <p className="mt-2 text-xs text-neutral-500">
                  Current period ends{" "}
                  {new Date(
                    subscription.currentPeriodEnd
                  ).toLocaleDateString()}
                </p>
              )}

              {syncState === "checking" && (
                <p className="mt-2 text-xs text-neutral-500">
                  Waiting for webhook sync… check #{attempts + 1}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={() => router.push("/profile")}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Go to profile
              </button>

              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05] disabled:opacity-50"
              >
                {refreshing ? "Refreshing..." : "Refresh plan status"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}