"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  useJournal,
  type JournalItem,
} from "@/components/journal/JournalContext";
import { moodConfig } from "@/lib/journal/moodMap";
import { SwipeableItem } from "@/components/ui/SwipeableItem";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import JournalEmpty from "@/components/JournalEmpty";
import { JournalSkeleton } from "@/components/journal/JournalSkeleton";

type MoodKey = keyof typeof moodConfig;

function isMoodKey(
  value: string | null | undefined
): value is MoodKey {
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

function getJournalPreview(item: JournalItem) {
  const meaningfulUserMessage = item.messages.find(
    (message) =>
      message.role === "user" &&
      !isLowSignalUserMessage(message.content)
  );

  if (meaningfulUserMessage) {
    return meaningfulUserMessage.content;
  }

  const firstUserMessage = item.messages.find(
    (message) => message.role === "user"
  );

  if (firstUserMessage) {
    return firstUserMessage.content;
  }

  const firstAssistantMessage = item.messages.find(
    (message) => message.role === "assistant"
  );

  return firstAssistantMessage?.content ?? "No preview available";
}

function getMessageLabel(count: number) {
  return `${count} message${count === 1 ? "" : "s"}`;
}

export default function JournalList() {
  const {
    items,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    deleteItem,
    addItem,
  } = useJournal();

  const router = useRouter();
  const pathname = usePathname();

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const deletedItemRef = useRef<JournalItem | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activeId = pathname?.startsWith("/journal/")
    ? pathname.split("/journal/")[1]
    : null;

  if (loading) {
    return <JournalSkeleton />;
  }

  if (items.length === 0) {
    return <JournalEmpty />;
  }

  const handleSwipeDelete = (item: JournalItem) => {
    deletedItemRef.current = item;

    deleteItem(item.id);

    setSnackbarVisible(true);

    timerRef.current = setTimeout(() => {
      deletedItemRef.current = null;
      setSnackbarVisible(false);
    }, 4000);
  };

  const handleUndo = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    if (timerRef.current) clearTimeout(timerRef.current);

    if (deletedItemRef.current) {
      addItem(deletedItemRef.current);
    }

    deletedItemRef.current = null;
    setSnackbarVisible(false);
  };

  return (
    <>
      <motion.div layout className="space-y-3">
        <AnimatePresence>
          {items.map((item) => {
            const mood = isMoodKey(item.mood)
              ? moodConfig[item.mood]
              : moodConfig.calm;

            const isActive = item.id === activeId;
            const preview = getJournalPreview(item);

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 40,
                }}
              >
                <SwipeableItem
                  onSwipeDelete={() => handleSwipeDelete(item)}
                >
                  <motion.div
                    onClick={() => {
                      if (isActive) return;

                      setTimeout(() => {
                        router.push(`/journal/${item.id}`);
                      }, 90);
                    }}
                    className={`
                      w-full rounded-2xl border px-4 py-3
                      transition-all duration-200 ease-out
                      ${
                        isActive
                          ? "border-white/15 bg-neutral-800"
                          : "border-white/5 bg-neutral-900"
                      }
                      hover:border-white/10 hover:bg-neutral-900/90
                      active:scale-[0.985]
                    `}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="truncate text-sm font-medium text-white">
                        {item.title || "Conversation"}
                      </h3>

                      <span className="shrink-0 text-xs opacity-70">
                        {mood.dot}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-neutral-400">
                      {preview}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <span
                        className={`h-2 w-2 rounded-full ${mood.color}`}
                      />
                      <span>{mood.label}</span>
                      <span>·</span>
                      <span>{getMessageLabel(item.messages.length)}</span>
                      <span>·</span>
                      <span>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </motion.div>
                </SwipeableItem>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {hasMore && (
          <div className="pt-2">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-300 transition hover:bg-white/[0.05] disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {snackbarVisible && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 40,
            }}
            className="fixed inset-x-0 bottom-0 z-[9999] flex justify-center"
            style={{
              paddingBottom:
                "calc(env(safe-area-inset-bottom) + 16px)",
            }}
          >
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-neutral-900/90 px-4 py-2 backdrop-blur-xl">
              <span className="whitespace-nowrap text-sm text-white">
                Conversation deleted
              </span>

              <button
                onClick={handleUndo}
                className="rounded-full px-4 py-2 -my-2 text-sm font-medium text-blue-400 transition hover:text-blue-300 active:scale-95"
              >
                Undo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}