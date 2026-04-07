"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";

export default function BillingSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setHeader, resetHeader } = useHeader();

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

  const sessionId = searchParams.get("session_id");

  return (
    <AuthGate>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 pt-24 pb-24">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg">
              ✓
            </div>

            <h1 className="mt-4 text-2xl font-semibold text-white">
              Checkout completed
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
              Stripe checkout completed. If webhook delivery is configured,
              your Pro plan should sync automatically in a moment.
            </p>

            {sessionId && (
              <p className="mt-3 break-all text-xs text-neutral-500">
                Session: {sessionId}
              </p>
            )}

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={() => router.push("/profile")}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Go to profile
              </button>

              <button
                onClick={() => router.push("/upgrade")}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
              >
                Back to upgrade
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}