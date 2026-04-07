"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";

export default function UpgradePage() {
  const router = useRouter();
  const { setHeader, resetHeader } = useHeader();

  const [loadingCheckout, setLoadingCheckout] = useState(false);

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

  async function handleCheckout() {
    try {
      setLoadingCheckout(true);

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          interval: "monthly",
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
              Pro is designed for people who want more depth, more insight,
              and a more complete personal reflection experience.
            </p>

            <button
              onClick={handleCheckout}
              disabled={loadingCheckout}
              className="mt-5 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {loadingCheckout
                ? "Preparing checkout..."
                : "Continue to checkout"}
            </button>
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
                Premium AI insights
              </div>
              <p className="mt-2 text-sm text-neutral-400">
                Get richer emotional patterns, stronger summaries, and more
                useful reflective guidance.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-sm font-medium text-white">
                Exportable reflection reports
              </div>
              <p className="mt-2 text-sm text-neutral-400">
                Save your progress as polished reports and take your reflections
                with you.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4">
            <div className="text-sm font-medium text-white">
              Stripe integration enabled
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              This flow uses real Stripe checkout. Webhook sync will activate
              Pro automatically after successful payment.
            </p>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}