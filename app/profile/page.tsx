"use client";

import { useEffect, useState } from "react";
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
} | null;

type SubscriptionInfo = {
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  isPro: boolean;
} | null;

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

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUserInfo({
        email: user?.email ?? null,
        id: user?.id ?? null,
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

    loadUser();
    loadUsage();
    loadSubscription();
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
                  {subscription?.isPro ? "pro" : "free"} plan
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

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => router.push("/upgrade")}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Upgrade to Pro
              </button>

              <button
                onClick={handlePortal}
                disabled={loadingPortal}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05] disabled:opacity-50"
              >
                {loadingPortal ? "Opening..." : "Manage billing"}
              </button>
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