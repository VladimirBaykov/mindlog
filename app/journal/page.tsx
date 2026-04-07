"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useHeader } from "@/components/header/HeaderContext";
import JournalList from "@/components/JournalList";
import AuthGate from "@/components/AuthGate";
import { supabase } from "@/lib/supabase-browser";

export default function JournalPage() {
  const { setHeader, resetHeader } = useHeader();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showCelebrate, setShowCelebrate] = useState(false);

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
          label: "Stats",
          onClick: () => router.push("/stats"),
        },
        {
          label: "Profile",
          onClick: () => router.push("/profile"),
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

    return () => {
      resetHeader();
    };
  }, [router, resetHeader, setHeader]);

  useEffect(() => {
    if (celebrate === "1") {
      setShowCelebrate(true);
    }
  }, [celebrate]);

  const celebrationCopy = useMemo(() => {
    return entryId
      ? "Your reflection was saved successfully. This is how MindLog starts building your private journal over time."
      : "Your reflection was saved successfully.";
  }, [entryId]);

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

  return (
    <AuthGate>
      <div className="h-screen overflow-hidden bg-black text-white">
        <div className="h-full overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-xl px-4 pt-20 pb-24">
            {showCelebrate && (
              <div className="mb-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-white">
                      Reflection saved
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                      {celebrationCopy}
                    </p>
                  </div>

                  <button
                    onClick={dismissCelebrate}
                    className="text-sm text-neutral-400 transition hover:text-white"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  {entryId && (
                    <button
                      onClick={() => router.push(`/journal/${entryId}`)}
                      className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
                    >
                      Open saved entry
                    </button>
                  )}

                  <button
                    onClick={() => router.push("/chat")}
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