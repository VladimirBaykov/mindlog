"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";

export default function UpgradePage() {
  const router = useRouter();
  const { setHeader, resetHeader } = useHeader();

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

  return (
    <AuthGate>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 pt-24 pb-24 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-6">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
              MindLog Pro
            </div>

            <h1 className="mt-3 text-3xl font-semibold text-white">
              Upgrade when you’re ready
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              Pro will unlock deeper AI reflection features, more storage,
              richer analytics, and premium export tools.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-sm font-medium text-white">
                Unlimited saved entries
              </div>
              <p className="mt-2 text-sm text-neutral-400">
                Save as many conversations as you want without free plan limits.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-sm font-medium text-white">
                Premium AI insights
              </div>
              <p className="mt-2 text-sm text-neutral-400">
                Get deeper emotional patterns, stronger summaries, and more useful
                reflection prompts.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-sm font-medium text-white">
                Export to PDF
              </div>
              <p className="mt-2 text-sm text-neutral-400">
                Keep personal reflection reports and share private snapshots when
                needed.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4">
            <div className="text-sm font-medium text-white">
              Payments are not connected yet
            </div>
            <p className="mt-2 text-sm text-neutral-400">
              This screen is the product foundation for the future Stripe flow.
              Next step will be wiring real billing.
            </p>

            <button
              onClick={() => router.push("/profile")}
              className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
            >
              Back to Profile
            </button>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}