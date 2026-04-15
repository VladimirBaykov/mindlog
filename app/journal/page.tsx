"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useHeader } from "@/components/header/HeaderContext";
import JournalList from "@/components/JournalList";
import AuthGate from "@/components/AuthGate";
import { supabase } from "@/lib/supabase-browser";
import { trackClientEvent } from "@/lib/analytics-client";

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

export default function JournalPage() {
  const { setHeader, resetHeader } = useHeader();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showCelebrate, setShowCelebrate] = useState(false);
  const [celebrateTracked, setCelebrateTracked] = useState(false);
  const [usage, setUsage] = useState<UsageInfo>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const celebrate = searchParams.get("celebrate");
  const entryId = searchParams.get("entry");

  useEffect(() => {
    setHeader({
      title: "Journal",
      rightSlot: (
        <Link
          href="/chat"
          className="text-sm text-neutral-400 hover:text-white transition"
        >
          New
        </Link>
      ),
      menuItems: [
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

    return () => {
      resetHeader();
    };
  }, [router, resetHeader, setHeader]);

  useEffect(() => {
    if (celebrate === "1") {
      setShowCelebrate(true);
    }
  }, [celebrate]);

  useEffect(() => {
    async function loadUsage() {
      try {
        setUsageLoading(true);

        const res = await fetch("/api/account/usage", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to load usage");
        }

        const data = (await res.json()) as UsageInfo;
        setUsage(data);
      } catch (error) {
        console.error("Usage load failed:", error);
        setUsage(null);
      } finally {
        setUsageLoading(false);
      }
    }

    loadUsage();
  }, []);

  useEffect(() => {
    if (!showCelebrate || celebrateTracked) {
      return;
    }

    setCelebrateTracked(true);

    trackClientEvent({
      eventName: "journal_celebration_viewed",
      page: "/journal",
      metadata: {
        entryId,
        used: usage?.used ?? null,
        remaining: usage?.remaining ?? null,
        plan: usage?.plan ?? null,
      },
    });
  }, [
    showCelebrate,
    celebrateTracked,
    entryId,
    usage?.used,
    usage?.remaining,
    usage?.plan,
  ]);

  const celebrationCopy = useMemo(() => {
    return entryId
      ? "Your reflection was saved successfully. This is no longer just a chat — it is now part of your journal history."
      : "Your reflection was saved successfully.";
  }, [entryId]);

  const progressCopy = useMemo(() => {
    if (usageLoading) {
      return "Updating your journal progress…";
    }

    if (!usage) {
      return "Your journal is growing one reflection at a time.";
    }

    if (usage.limit === null) {
      return `You now have ${usage.used} saved reflection${
        usage.used === 1 ? "" : "s"
      } in your journal.`;
    }

    return `You now have ${usage.used}/${usage.limit} saved reflection${
      usage.used === 1 ? "" : "s"
    } on your current plan.`;
  }, [usageLoading, usage]);

  const milestoneCopy = useMemo(() => {
    const count = usage?.used ?? 0;

    if (count <= 1) {
      return "This is your first saved reflection — the real value starts when your journal begins to accumulate over time.";
    }

    if (count < 5) {
      return "You are starting to build a real reflection streak. Each saved entry makes future patterns easier to notice.";
    }

    if (count < 10) {
      return "Your journal is gaining enough depth to become meaningfully useful, not just momentary.";
    }

    return "You already have meaningful history in MindLog. This is where journaling starts turning into self-knowledge.";
  }, [usage?.used]);

  function dismissCelebrate() {
    setShowCelebrate(false);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("celebrate");
    params.delete("entry");

    const next = params.toString()
      ? `/journal?${params.toString()}`
      : "/journal";

    router.replace(next);
  }

  async function openSavedEntry() {
    if (!entryId) return;

    await trackClientEvent({
      eventName: "journal_saved_entry_opened",
      page: "/journal",
      metadata: {
        entryId,
        used: usage?.used ?? null,
        plan: usage?.plan ?? null,
      },
    });

    router.push(`/journal/${entryId}`);
  }

  async function startNewReflection() {
    await trackClientEvent({
      eventName: "journal_post_save_new_reflection",
      page: "/journal",
      metadata: {
        entryId,
        used: usage?.used ?? null,
        plan: usage?.plan ?? null,
      },
    });

    router.push("/chat");
  }

  return (
    <AuthGate>
      <div className="h-screen overflow-hidden bg-black text-white">
        <div className="h-full overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-xl px-4 pt-8 pb-14">
            {showCelebrate && (
              <div className="mb-5 rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-200">
                      Reflection saved
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-neutral-100">
                      {celebrationCopy}
                    </p>
                  </div>

                  <button
                    onClick={dismissCelebrate}
                    className="text-sm text-neutral-300 transition hover:text-white"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-neutral-400">
                    Journal progress
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-200">
                    {progressCopy}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                    {milestoneCopy}
                  </p>
                </div>

                {usage?.plan === "free" &&
                  typeof usage?.remaining === "number" && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-neutral-200">
                          Free plan saves remaining
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-neutral-200">
                          {usage.remaining}
                        </div>
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                        Pro unlocks unlimited saved entries, deeper AI reflection,
                        weekly summaries, insights, and PDF export.
                      </p>

                      {usage.remaining <= 3 && (
                        <button
                          onClick={() => router.push("/upgrade")}
                          className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90"
                        >
                          Upgrade to Pro
                        </button>
                      )}
                    </div>
                  )}

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  {entryId && (
                    <button
                      onClick={openSavedEntry}
                      className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
                    >
                      Open saved entry
                    </button>
                  )}

                  <button
                    onClick={startNewReflection}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
                  >
                    Start another reflection
                  </button>
                </div>
              </div>
            )}

            <JournalList />
          </div>
        </div>
      </div>
    </AuthGate>
  );
}