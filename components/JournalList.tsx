"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  useJournal,
  type JournalItem,
} from "@/components/journal/JournalContext";
import { moodConfig } from "@/lib/journal/moodMap";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import JournalEmpty from "@/components/JournalEmpty";
import { JournalSkeleton } from "@/components/journal/JournalSkeleton";

type MoodKey = keyof typeof moodConfig;

type MenuPlacement = "top" | "bottom";

type ActiveMenu = {
  item: JournalItem;
  placement: MenuPlacement;
};

type JournalListProps = {
  selectionMode?: boolean;
  batchActionRequest?: number;
  onSelectionModeChange?: (nextValue: boolean) => void;
  onSelectionChange?: (count: number) => void;
};

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

function getDateLabel(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getMenuPlacement(element: HTMLElement): MenuPlacement {
  const rect = element.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;

  return spaceBelow < 260 ? "top" : "bottom";
}

export default function JournalList({
  selectionMode = false,
  batchActionRequest = 0,
  onSelectionModeChange,
  onSelectionChange,
}: JournalListProps) {
  const {
    items,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    deleteItem,
    updateItem,
  } = useJournal();

  const router = useRouter();
  const pathname = usePathname();

  const [activeMenu, setActiveMenu] = useState<ActiveMenu | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMenuOpen, setBatchMenuOpen] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = useRef(false);

  const activeId = pathname?.startsWith("/journal/")
    ? pathname.split("/journal/")[1]
    : null;

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  useEffect(() => {
    onSelectionChange?.(selectedIds.size);
  }, [onSelectionChange, selectedIds.size]);

  useEffect(() => {
    if (!selectionMode) {
      setSelectedIds(new Set());
      setBatchMenuOpen(false);
    }
  }, [selectionMode]);

  useEffect(() => {
    if (batchActionRequest > 0 && selectedIds.size > 0) {
      setBatchMenuOpen(true);
    }
  }, [batchActionRequest, selectedIds.size]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveMenu(null);
        setBatchMenuOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  if (loading) {
    return <JournalSkeleton />;
  }

  if (items.length === 0) {
    return <JournalEmpty />;
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function openEntry(id: string) {
    if (id === activeId) return;
    router.push(`/journal/${id}`);
  }

  function openItemMenu(item: JournalItem, element: HTMLElement) {
    clearLongPressTimer();
    longPressTriggeredRef.current = true;
    setActiveMenu({
      item,
      placement: getMenuPlacement(element),
    });
  }

  function handlePointerDown(
    item: JournalItem,
    event: React.PointerEvent<HTMLDivElement>
  ) {
    if (selectionMode) return;

    clearLongPressTimer();
    longPressTriggeredRef.current = false;

    const element = event.currentTarget;

    longPressTimerRef.current = setTimeout(() => {
      openItemMenu(item, element);
    }, 420);
  }

  function handlePointerUp() {
    clearLongPressTimer();
  }

  function handlePointerCancel() {
    clearLongPressTimer();
  }

  function handleCardClick(item: JournalItem) {
    if (selectionMode) {
      toggleSelected(item.id);
      return;
    }

    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    openEntry(item.id);
  }

  async function renameItem(item: JournalItem) {
    const nextTitle = prompt("New reflection title:", item.title || "");

    if (!nextTitle || nextTitle === item.title) return;

    await updateItem(item.id, { title: nextTitle });
    setActiveMenu(null);
  }

  async function deleteSingleItem(item: JournalItem) {
    const ok = confirm("Delete this reflection?");
    if (!ok) return;

    await deleteItem(item.id);
    setActiveMenu(null);
  }

  async function deleteSelectedItems() {
    if (selectedItems.length === 0) return;

    const ok = confirm(
      `Delete ${selectedItems.length} selected reflection${
        selectedItems.length === 1 ? "" : "s"
      }?`
    );

    if (!ok) return;

    for (const item of selectedItems) {
      await deleteItem(item.id);
    }

    setSelectedIds(new Set());
    setBatchMenuOpen(false);
    onSelectionModeChange?.(false);
  }

  return (
    <>
      <motion.div layout className="space-y-3">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const mood = isMoodKey(item.mood)
              ? moodConfig[item.mood]
              : moodConfig.calm;

            const isActive = item.id === activeId;
            const isSelected = selectedIds.has(item.id);
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
                <motion.div
                  onPointerDown={(event) => handlePointerDown(item, event)}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  onPointerLeave={handlePointerCancel}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    openItemMenu(item, event.currentTarget);
                  }}
                  onClick={() => handleCardClick(item)}
                  whileTap={{ scale: selectionMode ? 0.99 : 0.985 }}
                  className={`
                    relative w-full overflow-hidden rounded-[26px] border px-4 py-4
                    transition-all duration-200 ease-out
                    ${
                      isActive
                        ? "border-white/16 bg-white/[0.075]"
                        : "border-white/[0.07] bg-white/[0.035]"
                    }
                    ${isSelected ? "border-white/35 bg-white/[0.09]" : ""}
                    hover:border-white/14 hover:bg-white/[0.055]
                  `}
                >
                  <div className="flex items-center gap-4">
                    {selectionMode && (
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                          isSelected
                            ? "border-white bg-white text-black"
                            : "border-white/20 bg-white/[0.03] text-transparent"
                        }`}
                      >
                        <span className="text-xs font-semibold">✓</span>
                      </div>
                    )}

                    <div
                      className={`h-11 w-[5px] shrink-0 rounded-full ${mood.stripe}`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="truncate text-[15px] font-medium tracking-[-0.01em] text-white">
                          {item.title || "Conversation"}
                        </h3>

                        {!selectionMode && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              openItemMenu(item, event.currentTarget);
                            }}
                            className="-mr-1 -mt-1 rounded-full px-2 py-1 text-lg leading-none text-neutral-500 transition hover:bg-white/[0.06] hover:text-white"
                            aria-label="Open reflection actions"
                          >
                            ⋯
                          </button>
                        )}
                      </div>

                      <p className="mt-1.5 line-clamp-1 text-[13px] leading-relaxed text-neutral-400">
                        {preview}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <span
                          className={`rounded-full px-2.5 py-1 ${mood.softBg} text-neutral-200`}
                        >
                          {mood.label}
                        </span>
                        <span>·</span>
                        <span>{getDateLabel(item.createdAt)}</span>
                        <span>·</span>
                        <span>{getMessageLabel(item.messages.length)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
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
        {activeMenu && (
          <motion.div
            className="fixed inset-0 z-[9998] bg-black/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveMenu(null)}
          >
            <div
              className={`mx-auto flex min-h-full max-w-xl px-4 ${
                activeMenu.placement === "top"
                  ? "items-end pb-5"
                  : "items-center"
              }`}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
                onClick={(event) => event.stopPropagation()}
                className="w-full rounded-[28px] border border-white/10 bg-neutral-950/95 p-2 shadow-2xl shadow-black/50"
              >
                <div className="px-4 py-3">
                  <div className="truncate text-sm font-medium text-white">
                    {activeMenu.item.title || "Conversation"}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {getMessageLabel(activeMenu.item.messages.length)} · {getDateLabel(activeMenu.item.createdAt)}
                  </div>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => openEntry(activeMenu.item.id)}
                    className="flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-sm text-neutral-100 transition hover:bg-white/[0.06]"
                  >
                    <span>Open</span>
                    <span className="text-neutral-500">↗</span>
                  </button>

                  <button
                    onClick={() => renameItem(activeMenu.item)}
                    className="flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-sm text-neutral-100 transition hover:bg-white/[0.06]"
                  >
                    <span>Rename</span>
                    <span className="text-neutral-500">✎</span>
                  </button>

                  <button
                    onClick={() => router.push(`/journal/${activeMenu.item.id}/export`)}
                    className="flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-sm text-neutral-100 transition hover:bg-white/[0.06]"
                  >
                    <span>Export</span>
                    <span className="text-neutral-500">PDF</span>
                  </button>

                  <div className="my-1 h-px bg-white/[0.08]" />

                  <button
                    onClick={() => deleteSingleItem(activeMenu.item)}
                    className="flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-sm text-red-300 transition hover:bg-red-500/10"
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

      <AnimatePresence>
        {batchMenuOpen && selectedIds.size > 0 && (
          <motion.div
            className="fixed inset-0 z-[9998] bg-black/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBatchMenuOpen(false)}
          >
            <div className="mx-auto flex min-h-full max-w-xl items-end px-4 pb-5">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
                onClick={(event) => event.stopPropagation()}
                className="w-full rounded-[28px] border border-white/10 bg-neutral-950/95 p-2 shadow-2xl shadow-black/50"
              >
                <div className="px-4 py-3">
                  <div className="text-sm font-medium text-white">
                    {selectedIds.size} selected
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    Batch actions for selected reflections
                  </div>
                </div>

                <button
                  onClick={deleteSelectedItems}
                  className="flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-sm text-red-300 transition hover:bg-red-500/10"
                >
                  <span>Delete selected</span>
                  <span>⌫</span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
