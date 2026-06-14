"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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

type MoodKey = keyof typeof moodConfig;

type ReflectionMetadata = {
  summary?: string;
  keyTakeaway?: string;
  themes?: string[];
  chatType?: string;
};

type JournalItem = {
  id: string;
  title: string;
  mood?: MoodKey | string | null;
  metadata?: ReflectionMetadata | null;
  createdAt?: number;
  created_at?: string;
  messages?: Message[];
  content?: Message[];
  isFavorite?: boolean;
  is_favorite?: boolean | null;
  hiddenAt?: number | null;
  hidden_at?: string | null;
  locked?: boolean;
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

function isMoodKey(value: string | null | undefined): value is MoodKey {
  return Boolean(value && value in moodConfig);
}

function normalizeForDetection(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ");
}

function isLowSignalUserMessage(content: string) {
  const normalized = normalizeForDetection(content);

  if (!normalized) return true;

  const lowSignalExact = [
    "hi",
    "hey",
    "hello",
    "yo",
    "sup",
    "ok",
    "okay",
    "cool",
    "nice",
    "thanks",
    "thank you",
    "save it",
    "save this",
    "save this chat",
    "save this conversation",
    "save to journal",
    "can you save this",
    "can you save this chat",
    "can you save this conversation",
  ];

  if (lowSignalExact.includes(normalized)) {
    return true;
  }

  if (normalized.length <= 12) {
    return true;
  }

  if (
    normalized.startsWith("save ") ||
    normalized.includes(" save this") ||
    normalized.includes(" save it") ||
    normalized.includes("save to journal")
  ) {
    return true;
  }

  return false;
}

function getMeaningfulUserMessages(messages: Message[]) {
  return messages.filter(
    (message) =>
      message.role === "user" &&
      !isLowSignalUserMessage(message.content)
  );
}

function getReflectionFocus(messages: Message[]) {
  const meaningfulUserMessages = getMeaningfulUserMessages(messages);

  const source =
    meaningfulUserMessages[0]?.content ||
    messages.find((message) => message.role === "user")?.content ||
    "";

  const trimmed = source.trim().replace(/\s+/g, " ");

  if (!trimmed) {
    return "";
  }

  if (trimmed.length <= 240) {
    return trimmed;
  }

  return `${trimmed.slice(0, 240).trim()}…`;
}

function getShortFocus(messages: Message[]) {
  const focus = getReflectionFocus(messages);

  if (!focus) return "Saved from your conversation with MindLog.";

  if (focus.length <= 130) return focus;

  return `${focus.slice(0, 130).trim()}…`;
}

function getMessageLabel(count: number) {
  return `${count} message${count === 1 ? "" : "s"}`;
}

function getFallbackChatType(messages: Message[]) {
  const text = normalizeForDetection(
    messages.map((message) => message.content).join(" ")
  );

  if (
    text.includes("girl") ||
    text.includes("girlfriend") ||
    text.includes("boyfriend") ||
    text.includes("friend") ||
    text.includes("relationship") ||
    text.includes("date") ||
    text.includes("love")
  ) {
    return "Relationship reflection";
  }

  if (
    text.includes("work") ||
    text.includes("project") ||
    text.includes("business") ||
    text.includes("job")
  ) {
    return "Work reflection";
  }

  if (
    text.includes("anxious") ||
    text.includes("nervous") ||
    text.includes("scared") ||
    text.includes("sad") ||
    text.includes("heavy") ||
    text.includes("tired")
  ) {
    return "Emotional check-in";
  }

  if (
    text.includes("car") ||
    text.includes("porsche") ||
    text.includes("rolls") ||
    text.includes("weekend") ||
    text.includes("talk")
  ) {
    return "Casual conversation";
  }

  if (
    text.includes("should i") ||
    text.includes("what should") ||
    text.includes("decision") ||
    text.includes("choose")
  ) {
    return "Decision moment";
  }

  return "Personal reflection";
}

function formatChatType(value: string | undefined, messages: Message[]) {
  if (!value) return getFallbackChatType(messages);

  const labels: Record<string, string> = {
    personal_reflection: "Personal reflection",
    emotional_check_in: "Emotional check-in",
    relationship_reflection: "Relationship reflection",
    decision_moment: "Decision moment",
    work_reflection: "Work reflection",
    casual_conversation: "Casual conversation",
    planning: "Planning",
  };

  return labels[value] || getFallbackChatType(messages);
}

function getFallbackThemes(messages: Message[], moodLabel: string) {
  const text = normalizeForDetection(
    messages.map((message) => message.content).join(" ")
  );

  const themes: string[] = [];

  if (moodLabel && !themes.includes(moodLabel)) {
    themes.push(moodLabel);
  }

  if (text.includes("friend") || text.includes("relationship")) {
    themes.push("Connection");
  }

  if (
    text.includes("nervous") ||
    text.includes("scared") ||
    text.includes("anxious")
  ) {
    themes.push("Courage");
  }

  if (text.includes("work") || text.includes("project")) {
    themes.push("Work");
  }

  if (
    text.includes("car") ||
    text.includes("porsche") ||
    text.includes("rolls")
  ) {
    themes.push("Lifestyle");
  }

  if (text.includes("should i") || text.includes("what should")) {
    themes.push("Decision");
  }

  return Array.from(new Set(themes)).slice(0, 4);
}

function getThemes(
  metadataThemes: string[] | undefined,
  messages: Message[],
  moodLabel: string
) {
  if (Array.isArray(metadataThemes) && metadataThemes.length > 0) {
    return metadataThemes
      .filter((theme) => typeof theme === "string" && theme.trim())
      .slice(0, 4);
  }

  return getFallbackThemes(messages, moodLabel);
}

function getFavoriteState(item: JournalItem) {
  return Boolean(item.isFavorite ?? item.is_favorite);
}

function getHiddenAt(item: JournalItem) {
  if (typeof item.hiddenAt === "number") {
    return item.hiddenAt;
  }

  if (item.hidden_at) {
    return new Date(item.hidden_at).getTime();
  }

  return null;
}

export default function JournalEntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setHeader, resetHeader } = useHeader();
  const { updateItem, deleteItem, refresh } = useJournal();

  const [item, setItem] = useState<JournalItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] =
    useState<SubscriptionInfo>(null);
  const [loadingSubscription, setLoadingSubscription] =
    useState(true);
  const [usage, setUsage] = useState<UsageInfo>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [viewTracked, setViewTracked] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [entryUnlocked, setEntryUnlocked] = useState(false);
  const [entryCode, setEntryCode] = useState("");
  const [entryCodeError, setEntryCodeError] = useState("");
  const [checkingEntryCode, setCheckingEntryCode] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setEntryUnlocked(false);
    setEntryCode("");
    setEntryCodeError("");
    setViewTracked(false);
  }, [id]);

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

  const reflectionFocus = useMemo(
    () => getReflectionFocus(normalizedMessages),
    [normalizedMessages]
  );

  useEffect(() => {
    if (!item || item.locked || viewTracked) return;

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

    const mood = isMoodKey(item.mood) ? moodConfig[item.mood] : null;

    setHeader({
      title: item.title || "Reflection",
      subtitle: item.locked && !entryUnlocked ? "Locked" : mood?.label,
      leftSlot: (
        <button
          onClick={() => router.push("/journal")}
          className="text-sm text-neutral-400 hover:text-white transition"
        >
          ← Journal
        </button>
      ),
    });

    return () => resetHeader();
  }, [entryUnlocked, item, router, setHeader, resetHeader]);

  async function verifyEntryCode() {
    if (!item || checkingEntryCode) return;

    try {
      setCheckingEntryCode(true);
      setEntryCodeError("");

      const res = await fetch(`/api/journal/${item.id}/lock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: entryCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.verified) {
        throw new Error(data.error || "Incorrect code");
      }

      setEntryUnlocked(true);
      setEntryCode("");
      setEntryCodeError("");
    } catch (error) {
      console.error("Reflection unlock failed:", error);
      setEntryCodeError("Incorrect code. Try again.");
    } finally {
      setCheckingEntryCode(false);
    }
  }

  async function setEntryLock() {
    if (!item) return;

    const nextCode = prompt("New 4–8 digit access code:", "");
    if (!nextCode) return;

    const code = nextCode.trim();

    if (!/^\d{4,8}$/.test(code)) {
      alert("Use a 4–8 digit code.");
      return;
    }

    try {
      const res = await fetch(`/api/journal/${item.id}/lock`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not update access code.");
      }

      setItem((prev) => (prev ? { ...prev, locked: true } : prev));
      setEntryUnlocked(false);
      setEntryCode("");
      setActionsOpen(false);
      await refresh();
    } catch (error) {
      console.error("Set reflection lock failed:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not update access code."
      );
    }
  }

  async function clearEntryLock() {
    if (!item) return;

    const ok = confirm("Remove access code from this reflection?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/journal/${item.id}/lock`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clear: true }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not remove access code.");
      }

      setItem((prev) => (prev ? { ...prev, locked: false } : prev));
      setEntryUnlocked(true);
      setEntryCode("");
      setActionsOpen(false);
      await refresh();
    } catch (error) {
      console.error("Remove reflection lock failed:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not remove access code."
      );
    }
  }

  async function renameEntry() {
    if (!item) return;

    const nextTitle = prompt("New reflection title:", item.title || "");

    if (!nextTitle || nextTitle === item.title) return;

    setItem((prev) => (prev ? { ...prev, title: nextTitle } : prev));
    await updateItem(id, { title: nextTitle });
    setActionsOpen(false);
  }

  async function toggleFavoriteEntry() {
    if (!item) return;

    const nextValue = !getFavoriteState(item);

    setItem((prev) =>
      prev
        ? {
            ...prev,
            isFavorite: nextValue,
            is_favorite: nextValue,
          }
        : prev
    );

    await updateItem(id, { isFavorite: nextValue });
    setActionsOpen(false);
  }

  async function hideEntry() {
    if (!item) return;

    const now = Date.now();

    setItem((prev) =>
      prev
        ? {
            ...prev,
            hiddenAt: now,
            hidden_at: new Date(now).toISOString(),
          }
        : prev
    );

    await updateItem(id, { hiddenAt: now });
    setActionsOpen(false);
    router.push("/journal");
  }

  async function unhideEntry() {
    if (!item) return;

    setItem((prev) =>
      prev
        ? {
            ...prev,
            hiddenAt: null,
            hidden_at: null,
          }
        : prev
    );

    await updateItem(id, { hiddenAt: null });
    setActionsOpen(false);
  }

  async function deleteEntry() {
    if (!item) return;

    const ok = confirm("Delete this reflection?");
    if (!ok) return;

    await deleteItem(id);
    router.push("/journal");
  }

  async function openExport() {
    if (!item) return;

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
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 pt-8 pb-14 space-y-3">
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
        <div className="mx-auto max-w-xl px-4 pt-8 pb-14">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg">
              ⊘
            </div>

            <h2 className="mt-4 text-lg font-medium text-white">
              Reflection not found
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

  if (item.locked && !entryUnlocked) {
    return (
      <div className="relative min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 pt-8 pb-24">
          <div className="rounded-[30px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.025] px-5 py-7 text-center shadow-2xl shadow-black/20">
            <div className="mx-auto h-14 w-[5px] rounded-full bg-white" />

            <div className="mt-5 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              Locked reflection
            </div>

            <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.04em] text-white">
              {item.title || "Reflection"}
            </h1>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-neutral-400">
              Enter the access code to view this saved reflection.
            </p>

            <input
              value={entryCode}
              onChange={(event) => {
                setEntryCode(
                  event.target.value.replace(/\D/g, "").slice(0, 8)
                );
                setEntryCodeError("");
              }}
              inputMode="numeric"
              autoFocus
              placeholder="Code"
              className={`mx-auto mt-6 block w-full max-w-[260px] rounded-[18px] border bg-white/[0.04] px-4 py-3 text-center text-lg tracking-[0.2em] text-white outline-none transition placeholder:text-neutral-600 ${
                entryCodeError
                  ? "border-red-400/70 focus:border-red-300"
                  : "border-white/10 focus:border-white/25"
              }`}
            />

            {entryCodeError && (
              <p className="mx-auto mt-3 max-w-[260px] text-sm text-red-300">
                {entryCodeError}
              </p>
            )}

            <button
              onClick={verifyEntryCode}
              disabled={!entryCode || checkingEntryCode}
              className="mt-5 rounded-[18px] bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-40"
            >
              {checkingEntryCode ? "Checking..." : "Unlock reflection"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const mood = isMoodKey(item.mood)
    ? moodConfig[item.mood]
    : moodConfig.calm;

  const metadata = item.metadata || null;
  const createdDate = new Date(
    item.created_at || item.createdAt || Date.now()
  );
  const chatType = formatChatType(metadata?.chatType, normalizedMessages);
  const themes = getThemes(metadata?.themes, normalizedMessages, mood.label);
  const shortFocus = metadata?.summary || getShortFocus(normalizedMessages);
  const keyTakeaway =
    metadata?.keyTakeaway ||
    "This reflection is saved so you can return to the moment and its context later.";
  const isFavorite = getFavoriteState(item);
  const hiddenAt = getHiddenAt(item);

  const progressCopy = (() => {
    if (loadingUsage) {
      return "Updating journal status…";
    }

    if (!usage) {
      return "Your private journal is growing over time.";
    }

    if (usage.limit === null) {
      return `${usage.used} saved reflection${
        usage.used === 1 ? "" : "s"
      } in your journal.`;
    }

    return `${usage.used}/${usage.limit} saved reflection${
      usage.used === 1 ? "" : "s"
    } on your current plan.`;
  })();

  const actionsOverlay = (
    <AnimatePresence>
      {actionsOpen && (
        <motion.div
          className="fixed inset-0 z-[9998] bg-black/35 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setActionsOpen(false)}
        >
          <div className="fixed inset-x-0 bottom-0 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+18px)]">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ type: "spring", stiffness: 560, damping: 42 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-[360px] rounded-[24px] border border-white/10 bg-neutral-950/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
            >
              <div className="px-3 py-2.5">
                <div className="truncate text-[13px] font-medium text-white">
                  {item.title || "Reflection"}
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-500">
                  Reflection actions
                </div>
              </div>

              <div className="space-y-0.5">
                <button
                  onClick={renameEntry}
                  className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
                >
                  <span>Rename title</span>
                  <span className="text-neutral-500">✎</span>
                </button>

                <button
                  onClick={toggleFavoriteEntry}
                  className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
                >
                  <span>{isFavorite ? "Remove favorite" : "Favorite"}</span>
                  <span className="text-neutral-500">
                    {isFavorite ? "♡" : "♥"}
                  </span>
                </button>

                {hiddenAt ? (
                  <button
                    onClick={unhideEntry}
                    className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
                  >
                    <span>Unhide</span>
                    <span className="text-neutral-500">◎</span>
                  </button>
                ) : (
                  <button
                    onClick={hideEntry}
                    className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
                  >
                    <span>Hide</span>
                    <span className="text-neutral-500">◌</span>
                  </button>
                )}

                <button
                  onClick={setEntryLock}
                  className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
                >
                  <span>{item.locked ? "Change code" : "Lock"}</span>
                  <span className="text-neutral-500">Lock</span>
                </button>

                {item.locked && (
                  <button
                    onClick={clearEntryLock}
                    className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
                  >
                    <span>Remove lock</span>
                    <span className="text-neutral-500">Open</span>
                  </button>
                )}

                <button
                  onClick={openExport}
                  className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
                >
                  <span>Export</span>
                  <span className="text-neutral-500">PDF</span>
                </button>

                <div className="my-1 h-px bg-white/[0.08]" />

                <button
                  onClick={deleteEntry}
                  className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-red-300 transition hover:bg-red-500/10"
                >
                  <span>Delete</span>
                  <span>⌫</span>
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative min-h-screen bg-black text-white">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="mx-auto max-w-xl px-4 pt-8 pb-24"
      >
        <div className="mb-5 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.025] shadow-2xl shadow-black/20">
          <div className="flex gap-4 px-5 py-5">
            <div
              className={`mt-1 h-16 w-[5px] shrink-0 rounded-full ${mood.stripe}`}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={`inline-flex rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-200 ${mood.softBg}`}
                    >
                      {mood.label}
                    </div>
                    {isFavorite && (
                      <div className="inline-flex rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[11px] text-white">
                        ♥ Favorite
                      </div>
                    )}
                    {hiddenAt && (
                      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-neutral-300">
                        Hidden
                      </div>
                    )}
                    {item.locked && (
                      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-neutral-300">
                        Locked
                      </div>
                    )}
                  </div>

                  <h1 className="mt-4 text-[28px] font-semibold leading-tight tracking-[-0.04em] text-white">
                    {item.title || "Reflection"}
                  </h1>
                </div>

                <button
                  onClick={() => setActionsOpen(true)}
                  className="-mr-1 rounded-full px-3 py-1.5 text-xl leading-none text-neutral-400 transition hover:bg-white/[0.06] hover:text-white"
                  aria-label="Open reflection actions"
                >
                  ⋯
                </button>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-neutral-400">
                {shortFocus}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span>{createdDate.toLocaleDateString()}</span>
                <span>·</span>
                <span>
                  {createdDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span>·</span>
                <span>{getMessageLabel(normalizedMessages.length)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.08] px-5 py-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-semibold text-white">
                  {normalizedMessages.length}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                  Messages
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-white">
                  {userMessageCount}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                  Prompts
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-white">
                  {assistantMessageCount}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                  Replies
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-[28px] border border-white/10 bg-white/[0.035] px-5 py-5">
          <div className="text-sm font-medium text-white">
            Reflection insight
          </div>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            A focused view of this saved conversation only. Broader patterns
            will live in Stats later.
          </p>

          <div className="mt-5 grid gap-3">
            <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                Key takeaway
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-200">
                {keyTakeaway}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                  Chat type
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {chatType}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                  Mood
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm font-medium text-white">
                  <span className={`h-2.5 w-2.5 rounded-full ${mood.stripe}`} />
                  {mood.label}
                </div>
              </div>
            </div>

            {themes.length > 0 && (
              <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                  Themes
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {themes.map((theme) => (
                    <span
                      key={theme}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-200"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {reflectionFocus && (
              <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                  Original focus
                </div>
                <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                  {reflectionFocus}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mb-5 rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-5">
          <div className="text-sm font-medium text-white">
            Journal status
          </div>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            {progressCopy}
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/chat")}
              className="rounded-[18px] bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
            >
              Start another reflection
            </button>

            <button
              onClick={openExport}
              className="rounded-[18px] border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
            >
              {loadingSubscription
                ? "Open export"
                : subscription?.isPro
                ? "Export"
                : "Unlock export"}
            </button>
          </div>
        </div>

        <div className="mb-3 px-1">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
            Original conversation
          </div>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            The full saved conversation stays here for context.
          </p>
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

      {mounted && createPortal(actionsOverlay, document.body)}
    </div>
  );
}
