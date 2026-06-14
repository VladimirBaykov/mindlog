"use client";

import { useEffect, useMemo, useState } from "react";
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

type JournalViewMode = "all" | "favorites" | "hidden";

function getViewMode(value: string | null): JournalViewMode {
  if (value === "favorites" || value === "hidden") {
    return value;
  }

  return "all";
}

export default function JournalPage() {
  const { setHeader, resetHeader } = useHeader();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showCelebrate, setShowCelebrate] = useState(false);
  const [celebrateTracked, setCelebrateTracked] = useState(false);
  const [usage, setUsage] = useState<UsageInfo>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [batchActionRequest, setBatchActionRequest] = useState(0);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);

  const celebrate = searchParams.get("celebrate");
  const entryId = searchParams.get("entry");
  const viewMode = getViewMode(searchParams.get("view"));

  function navigateToView(nextView: JournalViewMode) {
    setPageMenuOpen(false);
    setSelectionMode(false);

    const params = new URLSearchParams(searchParams.toString());

    if (nextView === "all") {
      params.delete("view");
    } else {
      params.set("view", nextView);
    }

    params.delete("celebrate");
    params.delete("entry");

    const next = params.toString()
      ? `/journal?${params.toString()}`
      : "/journal";

    router.push(next);
  }

  useEffect(() => {
    setHeader({
      title:
        viewMode === "favorites"
          ? "Favorites"
          : viewMode === "hidden"
          ? "Hidden"
          : "Journal",
      rightSlot: (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (selectionMode) {
                setBatchActionRequest((value) => value + 1);
                return;
              }

              setPageMenuOpen((value) => !value);
            }}
            disabled={selectionMode && selectedCount === 0}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-neutral-300 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
            aria-label={
              selectionMode
                ? "Open selected actions"
                : "Open journal actions"
            }
          >
            ⋯
          </button>

          <button
            onClick={() => {
              setPageMenuOpen(false);
              setSelectionMode((value) => !value);
            }}
            className="rounded-full px-3 py-1.5 text-sm text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
            aria-label={selectionMode ? "Exit selection" : "Select reflections"}
          >
            {selectionMode ? "×" : "Select"}
          </button>
        </div>
      ),
    });

    return () => {
      resetHeader();
    };
  }, [
    resetHeader,
    selectedCount,
    selectionMode,
    setHeader,
    viewMode,
  ]);

  useEffect(() => {
    setSelectionMode(false);
    setSelectedCount(0);
    setPageMenuOpen(false);
  }, [viewMode]);

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
      ? "Your reflection was saved. It now lives in your private journal."
      : "Your reflection was saved successfully.";
  }, [entryId]);

  const saveStatusCopy = useMemo(() => {
    if (usageLoading) {
      return "Checking your journal…";
    }

    if (!usage) {
      return "Your saved reflections are kept here as a private memory layer.";
    }

    if (usage.limit === null) {
      return `${usage.used} saved reflection${
        usage.used === 1 ? "" : "s"
      } · Unlimited saves active`;
    }

    return `${usage.used}/${usage.limit} saved reflection${
      usage.used === 1 ? "" : "s"
    } used`;
  }, [usageLoading, usage]);

  const limitPillCopy = useMemo(() => {
    if (usageLoading) return "Loading";
    if (!usage) return "Private journal";
    if (usage.limit === null) return "Pro active";

    return typeof usage.remaining === "number"
      ? `${usage.remaining} saves left`
      : "Free plan";
  }, [usageLoading, usage]);

  const viewCopy = useMemo(() => {
    if (viewMode === "favorites") {
      return {
        eyebrow: "Favorite reflections",
        title: "Moments worth keeping close.",
        body: "Your favorite saved reflections live here, separate from the full journal.",
        status: "Favorites are part of your private reflection library.",
      };
    }

    if (viewMode === "hidden") {
      return {
        eyebrow: "Hidden reflections",
        title: "Private entries, tucked away.",
        body: "Hidden reflections stay out of your main journal until you restore them.",
        status: "Only you can access this hidden view from the Journal menu.",
      };
    }

    return {
      eyebrow: "Your reflection journal",
      title: "Your reflections, remembered.",
      body: "Saved conversations become private entries you can revisit, organize, export, and continue later.",
      status: saveStatusCopy,
    };
  }, [saveStatusCopy, viewMode]);

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

  async function signOut() {
    setPageMenuOpen(false);
    await supabase.auth.signOut();
    router.refresh();
    router.push("/sign-in");
  }

  return (
    <AuthGate>
      <div className="min-h-[calc(100vh-108px)] bg-black text-white">
        {pageMenuOpen && !selectionMode && (
          <div
            className="fixed inset-0 z-[9997]"
            onClick={() => setPageMenuOpen(false)}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="absolute right-4 top-[54px] w-[220px] overflow-hidden rounded-[22px] border border-white/10 bg-neutral-950/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
            >
              <button
                onClick={() => navigateToView("all")}
                className={`flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-sm transition hover:bg-white/[0.06] ${
                  viewMode === "all" ? "text-white" : "text-neutral-300"
                }`}
              >
                <span>All reflections</span>
                <span className="text-neutral-500">Journal</span>
              </button>

              <button
                onClick={() => navigateToView("favorites")}
                className={`flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-sm transition hover:bg-white/[0.06] ${
                  viewMode === "favorites" ? "text-white" : "text-neutral-300"
                }`}
              >
                <span>Favorites</span>
                <span className="text-rose-300">♥</span>
              </button>

              <button
                onClick={() => navigateToView("hidden")}
                className={`flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-sm transition hover:bg-white/[0.06] ${
                  viewMode === "hidden" ? "text-white" : "text-neutral-300"
                }`}
              >
                <span>Hidden</span>
                <span className="text-neutral-500">◌</span>
              </button>

              <div className="my-1 h-px bg-white/[0.08]" />

              <button
                onClick={() => {
                  setPageMenuOpen(false);
                  router.push("/stats");
                }}
                className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-sm text-neutral-100 transition hover:bg-white/[0.06]"
              >
                <span>View stats</span>
                <span className="text-neutral-500">↗</span>
              </button>

              {usage?.plan === "free" && (
                <button
                  onClick={() => {
                    setPageMenuOpen(false);
                    router.push("/upgrade");
                  }}
                  className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-sm text-neutral-100 transition hover:bg-white/[0.06]"
                >
                  <span>Upgrade</span>
                  <span className="text-neutral-500">Pro</span>
                </button>
              )}

              <div className="my-1 h-px bg-white/[0.08]" />

              <button
                onClick={signOut}
                className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10"
              >
                <span>Logout</span>
                <span>↪</span>
              </button>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-xl px-4 pt-6 pb-28">
          {showCelebrate && viewMode === "all" && (
            <div className="mb-5 rounded-[26px] border border-emerald-400/20 bg-emerald-400/10 px-5 py-5">
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

              {entryId && (
                <button
                  onClick={openSavedEntry}
                  className="mt-4 rounded-[18px] bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
                >
                  Open saved entry
                </button>
              )}
            </div>
          )}

          <div className="mb-5 rounded-[30px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.025] px-5 py-5 shadow-2xl shadow-black/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                  {viewCopy.eyebrow}
                </div>
                <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.04em] text-white">
                  {viewCopy.title}
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
                  {viewCopy.body}
                </p>
              </div>

              <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-neutral-200">
                {viewMode === "all" ? limitPillCopy : viewMode}
              </div>
            </div>

            <div className="mt-5 rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                {viewMode === "all" ? "Journal status" : "Collection status"}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-200">
                {viewCopy.status}
              </p>
              {usage?.plan === "free" && viewMode === "all" && (
                <button
                  onClick={() => router.push("/upgrade")}
                  className="mt-4 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.07]"
                >
                  Upgrade for unlimited saves
                </button>
              )}
            </div>
          </div>

          {selectionMode && (
            <div className="mb-4 rounded-[22px] border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-neutral-300">
              {selectedCount === 0
                ? "Select reflections to manage them."
                : `${selectedCount} selected`}
            </div>
          )}

          <JournalList
            viewMode={viewMode}
            selectionMode={selectionMode}
            batchActionRequest={batchActionRequest}
            onSelectionModeChange={setSelectionMode}
            onSelectionChange={setSelectedCount}
          />
        </div>
      </div>
    </AuthGate>
  );
}
