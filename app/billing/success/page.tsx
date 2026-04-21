"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";
import { trackClientEvent } from "@/lib/analytics-client";
import {
  fetchSubscription,
  type SubscriptionInfo,
} from "@/lib/account-client";

type SyncState = "checking" | "active" | "pending" | "error";

export default function BillingSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setHeader, resetHeader } = useHeader();

  const [syncState, setSyncState] = useState<SyncState>("checking");
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  const sessionId = searchParams.get("session_id");

  const viewTrackedRef = useRef(false);
  const confirmedTrackedRef = useRef(false);

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

  useEffect(() => {
    if (viewTrackedRef.current) return;
    viewTrackedRef.current = true;

    trackClientEvent({
      eventName: "billing_success_viewed",
      page: "/billing/success",
      metadata: { sessionId },
    });
  }, [sessionId]);

  async function fetchSubscriptionStatus(signal?: AbortSignal) {
    const data = await fetchSubscription(signal);

    if (signal?.aborted) return false;

    setSubscription(data);

    if (data.isPro) {
      setSyncState("active");

      if (!confirmedTrackedRef.current) {
        confirmedTrackedRef.current = true;

        trackClientEvent({
          eventName: "billing_success_pro_confirmed",
          page: "/billing/success",
          metadata: {
            sessionId,
            status: data.status,
            plan: data.plan,
            currentPeriodEnd: data.currentPeriodEnd,
          },
        });
      }

      return true;
    }

    return false;
  }

  useEffect(() => {
    const controller = new AbortController();
    let intervalId: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    async function startPolling() {
      setSyncState("checking");

      try {
        const active = await fetchSubscriptionStatus(controller.signal);

        if (controller.signal.aborted) return;
        if (active) return;

        intervalId = setInterval(async () => {
          try {
            setAttempts((prev) => prev + 1);
            const isActive = await fetchSubscriptionStatus(controller.signal);

            if (controller.signal.aborted) return;

            if (isActive && intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          } catch (error) {
            if (!controller.signal.aborted) {
              console.error("Subscription polling failed:", error);
            }
          }
        }, 2000);

        timeoutId = setTimeout(() => {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }

          if (!controller.signal.aborted) {
            setSyncState((prev) => (prev === "active" ? prev : "pending"));
          }
        }, 16000);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Initial subscription check failed:", error);
          setSyncState("error");
        }
      }
    }

    startPolling();

    return () => {
      controller.abort();
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (syncState !== "active") return;

    setRedirectCountdown(3);

    const intervalId = setInterval(() => {
      setRedirectCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);

    const timeoutId = setTimeout(() => {
      router.replace("/profile?upgraded=1");
    }, 2400);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [syncState, router]);

  async function handleManualRefresh() {
    try {
      setRefreshing(true);
      setSyncState("checking");

      await trackClientEvent({
        eventName: "billing_success_refresh_clicked",
        page: "/billing/success",
        metadata: {
          sessionId,
          previousState: syncState,
          attempts,
        },
      });

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
        title: "You’re officially Pro",
        description:
          "Your payment completed and MindLog confirmed your subscription successfully.",
        icon: "✓",
        tone: "ok",
      };
    }

    if (syncState === "pending") {
      return {
        title: "Payment completed, sync still pending",
        description:
          "Stripe checkout finished, but Pro has not appeared yet. This usually means the webhook is still syncing your subscription.",
        icon: "…",
        tone: "warn",
      };
    }

    if (syncState === "error") {
      return {
        title: "Couldn’t confirm subscription yet",
        description:
          "The payment flow completed, but this page couldn’t verify your latest subscription status right now.",
        icon: "!",
        tone: "neutral",
      };
    }

    return {
      title: "Checking your subscription",
      description:
        "Stripe checkout completed. MindLog is now checking whether your Pro plan is already active.",
      icon: "…",
      tone: "neutral",
    };
  }, [syncState]);

  const toneClasses =
    statusBlock.tone === "ok"
      ? "border-emerald-500/20 bg-emerald-500/10"
      : statusBlock.tone === "warn"
      ? "border-amber-500/20 bg-amber-500/10"
      : "border-white/10 bg-white/[0.03]";

  return (
    <AuthGate>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl space-y-6 px-4 pb-24 pt-24">
          <div className={`rounded-3xl border px-6 py-8 text-center ${toneClasses}`}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg">
              {statusBlock.icon}
            </div>

            <h1 className="mt-4 text-2xl font-semibold text-white">
              {statusBlock.title}
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-300">
              {statusBlock.description}
            </p>

            {syncState === "active" && (
              <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-neutral-400">
                Redirecting to your profile in about {redirectCountdown}s…
              </p>
            )}

            {sessionId && (
              <p className="mt-3 break-all text-xs text-neutral-500">
                Session: {sessionId}
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
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
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}

            {syncState === "checking" && (
              <p className="mt-2 text-xs text-neutral-500">
                Waiting for webhook sync… check #{attempts + 1}
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="text-sm font-medium text-white">
              What Pro unlocks now
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-sm font-medium text-white">
                  Weekly reflection summary
                </div>
                <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                  Review emotional movement across your recent journal history.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-sm font-medium text-white">
                  Premium AI insights
                </div>
                <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                  Notice stronger patterns and more meaningful reflective signals.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-sm font-medium text-white">
                  Deeper conversation depth
                </div>
                <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                  Keep longer reflections without hitting the free depth ceiling.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-sm font-medium text-white">
                  PDF export
                </div>
                <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                  Turn important entries into clean, portable reflection reports.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="text-sm font-medium text-white">
              Next step
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {syncState === "active"
                ? "You can start using Pro right away, or just let this page send you back to profile automatically."
                : "You can refresh plan status, open profile, or wait briefly while Stripe sync completes."}
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => router.push("/chat")}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Start a Pro reflection
              </button>

              <button
                onClick={() => router.push("/profile?upgraded=1")}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
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