"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useHeader } from "@/components/header/HeaderContext";
import { useJournal } from "@/components/journal/JournalContext";
import { moodConfig } from "@/lib/journal/moodMap";
import { motion, AnimatePresence } from "framer-motion";
import { trackClientEvent } from "@/lib/analytics-client";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type JournalItem = {
  id: string;
  title: string;
  mood?: keyof typeof moodConfig;
  createdAt?: number;
  created_at?: string;
  messages?: Message[];
  content?: Message[];
};

type SubscriptionInfo = {
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  isPro: boolean;
} | null;

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

export default function JournalEntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setHeader, resetHeader } = useHeader();
  const { updateItem, deleteItem } = useJournal();

  const [item, setItem] = useState<JournalItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] =
    useState<SubscriptionInfo>(null);
  const [loadingSubscription, setLoadingSubscription] =
    useState(true);
  const [usage, setUsage] = useState<UsageInfo>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [viewTracked, setViewTracked] = useState(false);

  useEffect(() => {
    fetch(`/api/journal/${id}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => setItem(data))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetch("/api/account/subscription", {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => setSubscription(data))
      .finally(() => setLoadingSubscription(false));
  }, []);

  useEffect(() => {
    fetch("/api/account/usage", {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => setUsage(data))
      .finally(() => setLoadingUsage(false));
  }, []);

  const normalizedMessages = useMemo(() => {
    if (!item) return [];
    if (Array.isArray(item.messages)) return item.messages;
    if (Array.isArray(item.content)) return item.content;
    return [];
  }, [item]);

  const userMessageCount = useMemo(
    () => normalizedMessages.filter((msg) => msg.role === "user").length,
    [normalizedMessages]
  );

  const assistantMessageCount = useMemo(
    () =>
      normalizedMessages.filter((msg) => msg.role === "assistant").length,
    [normalizedMessages]
  );

  useEffect(() => {
    if (!item || viewTracked) return;

    setViewTracked(true);

    trackClientEvent({
      eventName: "journal_entry_viewed",
      page: `/journal/${id}`,
      metadata: {
        entryId: item.id,
        mood: item.mood || "unknown",
        messageCount: normalizedMessages.length,
        userMessageCount,
        assistantMessageCount,
        plan: usage?.plan ?? null,
      },
    });
  }, [
    item,
    viewTracked,
    id,
    normalizedMessages.length,
    userMessageCount,
    assistantMessageCount,
    usage?.plan,
  ]);

  useEffect(() => {
    if (!item) return;

    const mood =
      item.mood && moodConfig[item.mood]
        ? moodConfig[item.mood]
        : null;

    setHeader({
      title: item.title || "Conversation",
      subtitle: mood?.label,
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
          label: subscription?.isPro
            ? "Export to PDF"
            : "Export to PDF (Pro)",
          highlight: true,
          onClick: async () => {
            await trackClientEvent({
              eventName: "journal_entry_export_cta_clicked",
              page: `/journal/${id}`,
              metadata: {
                entryId: item.id,
                isPro: Boolean(subscription?.isPro),
                plan: subscription?.plan || "free",
              },
            });

            router.push(`/journal/${id}/export`);
          },
        },
        {
          label: "Rename",
          onClick: async () => {
            const nextTitle = prompt(
              "New conversation title:",
              item.title || ""
            );

            if (!nextTitle || nextTitle === item.title) return;

            setItem((prev) =>
              prev ? { ...prev, title: nextTitle } : prev
            );

            await updateItem(id, { title: nextTitle });
          },
        },
        {
          label: "Delete conversation",
          danger: true,
          onClick: async () => {
            const ok = confirm("Delete this conversation?");
            if (!ok) return;

            await deleteItem(id);
            router.push("/journal");
          },
        },
      ],
    });

    return () => resetHeader();
  }, [
    item,
    id,
    router,
    setHeader,
    resetHeader,
    updateItem,
    deleteItem,
    subscription?.isPro,
    subscription?.plan,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 pt-8 pb-24 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-4"
            >
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/[0.08]" />
              <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-white/[0.05]" />
              <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-white/[0.05]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 pt-8 pb-24">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg">
              ⊘
            </div>

            <h2 className="mt-4 text-lg font-medium text-white">
              Conversation not found
            </h2>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-neutral-400">
              This entry may have been deleted, moved, or is no longer
              available.
            </p>

            <button
              onClick={() => router.push("/journal")}
              className="mt-6 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
            >
              Back to journal
            </button>
          </div>
        </div>
      </div>
    );
  }

  const mood =
    item.mood && moodConfig[item.mood]
      ? moodConfig[item.mood]
      : moodConfig.calm;

  const createdDate = new Date(
    item.created_at || item.createdAt || Date.now()
  );

  const reflectionStageCopy = (() => {
    if (normalizedMessages.length <= 3) {
      return "A short reflection snapshot you can return to later.";
    }

    if (normalizedMessages.length <= 8) {
      return "A solid reflection entry with enough context to revisit meaningfully.";
    }

    return "A deeper reflection entry with enough texture to support pattern recognition over time.";
  })();

  const progressCopy = (() => {
    if (loadingUsage) {
      return "Updating your journal progress…";
    }

    if (!usage) {
      return "Your private journal is growing over time.";
    }

    if (usage.limit === null) {
      return `You currently have ${usage.used} saved reflection${
        usage.used === 1 ? "" : "s"
      } in your journal.`;
    }

    return `You currently have ${usage.used}/${usage.limit} saved reflection${
      usage.used === 1 ? "" : "s"
    } on your current plan.`;
  })();

  const nextActionCopy = (() => {
    if (subscription?.isPro) {
      return "Export this entry, continue reflecting, or review your stats to notice longer-term emotional patterns.";
    }

    return "Open export to preview Pro value, start another reflection, or keep building your history inside the journal.";
  })();

  return (
    <div className="relative min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed top-0 left-0 right-0 z-30 h-20 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="mx-auto max-w-xl px-4 pt-8 pb-24"
      >
        <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-300">
                <span className={`h-2 w-2 rounded-full ${mood.color}`} />
                {mood.label}
              </div>

              <div className="mt-4 text-xl font-medium text-white">
                {item.title || "Conversation"}
              </div>

              <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
                {reflectionStageCopy}
              </p>
            </div>

            <div className="text-right text-xs text-neutral-500">
              <div>{createdDate.toLocaleDateString()}</div>
              <div className="mt-1">
                {createdDate.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                Messages
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {normalizedMessages.length}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                Your prompts
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {userMessageCount}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                AI replies
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {assistantMessageCount}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
              Journal progress
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-300">
              {progressCopy}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              The more entries you keep, the easier it becomes to notice
              patterns, shifts, and recurring emotional themes.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-white">
                  Export this reflection
                </div>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  {loadingSubscription
                    ? "Checking your plan..."
                    : subscription?.isPro
                    ? "Open a clean export view and save it as a PDF."
                    : "PDF export is available on Pro."}
                </p>
              </div>

              <button
                onClick={async () => {
                  await trackClientEvent({
                    eventName: "journal_entry_export_cta_clicked",
                    page: `/journal/${id}`,
                    metadata: {
                      entryId: item.id,
                      isPro: Boolean(subscription?.isPro),
                      plan: subscription?.plan || "free",
                    },
                  });

                  router.push(`/journal/${id}/export`);
                }}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                {loadingSubscription
                  ? "Open export"
                  : subscription?.isPro
                  ? "Export to PDF"
                  : "Unlock PDF export"}
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4">
            <div className="text-sm font-medium text-white">
              What to do next
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {nextActionCopy}
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={async () => {
                  await trackClientEvent({
                    eventName: "journal_entry_new_reflection_clicked",
                    page: `/journal/${id}`,
                    metadata: {
                      entryId: item.id,
                      plan: usage?.plan ?? subscription?.plan ?? null,
                    },
                  });

                  router.push("/chat");
                }}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Start another reflection
              </button>

              <button
                onClick={() => router.push("/stats")}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
              >
                View reflection stats
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {normalizedMessages.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5 text-sm text-neutral-400">
                No messages in this entry yet.
              </div>
            ) : (
              normalizedMessages.map((msg, idx) => {
                const isUser = msg.role === "user";
                const previous = normalizedMessages[idx - 1];
                const groupedWithPrevious =
                  previous && previous.role === msg.role;

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: 0.22,
                      delay: idx * 0.015,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className={`flex ${
                      isUser ? "justify-end" : "justify-start"
                    } ${groupedWithPrevious ? "pt-1" : "pt-3"}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-[22px] border px-4 py-3 text-[14.5px] leading-[1.55] ${
                        isUser
                          ? "border-white/[0.08] bg-white/[0.07] text-white"
                          : "border-white/[0.06] bg-white/[0.035] text-neutral-200"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}