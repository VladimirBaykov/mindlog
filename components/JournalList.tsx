"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  useJournal,
  type JournalItem,
} from "@/components/journal/JournalContext";
import { moodConfig } from "@/lib/journal/moodMap";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import JournalEmpty from "@/components/JournalEmpty";
import { JournalSkeleton } from "@/components/journal/JournalSkeleton";
import AccessCodeDialog from "@/components/journal/AccessCodeDialog";

type MoodKey = keyof typeof moodConfig;
type JournalViewMode = "all" | "favorites" | "hidden";
type MenuPlacement = "top" | "bottom";

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  placement: MenuPlacement;
};

type ActiveMenu = {
  item: JournalItem;
  position: MenuPosition;
};

type LockDialogState =
  | { mode: "set"; item: JournalItem }
  | { mode: "remove"; item: JournalItem };

type JournalListProps = {
  viewMode?: JournalViewMode;
  selectionMode?: boolean;
  batchActionRequest?: number;
  onSelectionModeChange?: (nextValue: boolean) => void;
  onSelectionChange?: (count: number) => void;
};

const MENU_ESTIMATED_HEIGHT = 300;
const VIEWPORT_PADDING = 14;
const HEADER_SAFE_TOP = 66;

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

function getJournalPreview(item: JournalItem) {
  if (item.metadata?.summary) return item.metadata.summary;

  const meaningfulUserMessage = item.messages.find(
    (message) =>
      message.role === "user" && !isLowSignalUserMessage(message.content),
  );

  if (meaningfulUserMessage) {
    return meaningfulUserMessage.content;
  }

  const firstUserMessage = item.messages.find(
    (message) => message.role === "user",
  );

  if (firstUserMessage) {
    return firstUserMessage.content;
  }

  const firstAssistantMessage = item.messages.find(
    (message) => message.role === "assistant",
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

function isItemSoftLocked(item: JournalItem) {
  return Boolean(item.locked || item.metadata?.accessHash);
}

async function createAccessHash(itemId: string, code: string) {
  const input = `mindlog-entry-access-v1:${itemId}:${code}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getMenuPosition(element: HTMLElement): MenuPosition {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxMenuWidth = Math.min(340, viewportWidth - VIEWPORT_PADDING * 2);
  const width = Math.min(Math.max(rect.width * 0.82, 250), maxMenuWidth);

  const left = Math.min(
    Math.max(rect.left + (rect.width - width) / 2, VIEWPORT_PADDING),
    viewportWidth - width - VIEWPORT_PADDING,
  );

  const spaceBelow = viewportHeight - rect.bottom;
  const shouldOpenTop = spaceBelow < MENU_ESTIMATED_HEIGHT + 18;

  if (shouldOpenTop) {
    return {
      top: Math.max(HEADER_SAFE_TOP, rect.top - MENU_ESTIMATED_HEIGHT - 8),
      left,
      width,
      placement: "top",
    };
  }

  return {
    top: Math.min(
      rect.bottom + 8,
      viewportHeight - MENU_ESTIMATED_HEIGHT - VIEWPORT_PADDING,
    ),
    left,
    width,
    placement: "bottom",
  };
}

function getCardElement(element: HTMLElement) {
  return (
    (element.closest("[data-journal-card='true']") as HTMLElement | null) ||
    element
  );
}

function getVisibleItems(items: JournalItem[], viewMode: JournalViewMode) {
  if (viewMode === "favorites") {
    return items.filter((item) => item.isFavorite && !item.hiddenAt);
  }

  if (viewMode === "hidden") {
    return items.filter((item) => item.hiddenAt);
  }

  return items.filter((item) => !item.hiddenAt);
}

function EmptyView({ viewMode }: { viewMode: JournalViewMode }) {
  if (viewMode === "favorites") {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-8 text-center">
        <div className="text-sm font-medium text-white">No favorites yet</div>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-400">
          Mark meaningful reflections as favorites and they will appear here.
        </p>
      </div>
    );
  }

  if (viewMode === "hidden") {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-8 text-center">
        <div className="text-sm font-medium text-white">
          No hidden reflections
        </div>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-400">
          Hidden reflections stay out of your main journal and can be restored
          from here.
        </p>
      </div>
    );
  }

  return <JournalEmpty />;
}

export default function JournalList({
  viewMode = "all",
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
    refresh,
    loadMore,
    deleteItem,
    updateItem,
  } = useJournal();

  const router = useRouter();
  const pathname = usePathname();

  const [activeMenu, setActiveMenu] = useState<ActiveMenu | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMenuOpen, setBatchMenuOpen] = useState(false);
  const [lockDialog, setLockDialog] = useState<LockDialogState | null>(null);
  const [lockDialogBusy, setLockDialogBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = useRef(false);

  const activeId = pathname?.startsWith("/journal/")
    ? pathname.split("/journal/")[1]
    : null;

  const visibleItems = useMemo(
    () => getVisibleItems(items, viewMode),
    [items, viewMode],
  );

  const selectedItems = useMemo(
    () => visibleItems.filter((item) => selectedIds.has(item.id)),
    [visibleItems, selectedIds],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

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
    setSelectedIds(new Set());
    setBatchMenuOpen(false);
    setActiveMenu(null);
  }, [viewMode]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const visibleIds = new Set(visibleItems.map((item) => item.id));
      const next = new Set(Array.from(prev).filter((id) => visibleIds.has(id)));

      return next.size === prev.size ? prev : next;
    });
  }, [visibleItems]);

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

  if (visibleItems.length === 0) {
    return <EmptyView viewMode={viewMode} />;
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

  function openEntry(item: JournalItem) {
    if (item.id === activeId) return;
    router.push(`/journal/${item.id}`);
  }

  function openItemMenu(item: JournalItem, element: HTMLElement) {
    clearLongPressTimer();
    longPressTriggeredRef.current = true;
    setActiveMenu({
      item,
      position: getMenuPosition(getCardElement(element)),
    });
  }

  function handlePointerDown(
    item: JournalItem,
    event: React.PointerEvent<HTMLDivElement>,
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

    openEntry(item);
  }

  async function renameItem(item: JournalItem) {
    const nextTitle = prompt("New reflection title:", item.title || "");

    if (!nextTitle || nextTitle === item.title) return;

    await updateItem(item.id, { title: nextTitle });
    setActiveMenu(null);
  }

  async function toggleFavorite(item: JournalItem) {
    await updateItem(item.id, {
      isFavorite: !item.isFavorite,
    });
    setActiveMenu(null);
  }

  async function hideItem(item: JournalItem) {
    await updateItem(item.id, {
      hiddenAt: Date.now(),
    });
    setActiveMenu(null);
  }

  async function unhideItem(item: JournalItem) {
    await updateItem(item.id, {
      hiddenAt: null,
    });
    setActiveMenu(null);
  }

  function openSetItemLock(item: JournalItem) {
    setActiveMenu(null);
    setLockDialog({ mode: "set", item });
  }

  function openRemoveItemLock(item: JournalItem) {
    setActiveMenu(null);
    setLockDialog({ mode: "remove", item });
  }

  async function applyItemLock(code: string) {
    if (!lockDialog || lockDialog.mode !== "set") return;

    const item = lockDialog.item;
    const accessHash = await createAccessHash(item.id, code);
    const metadata = {
      ...(item.metadata || {}),
      accessHash,
    };

    try {
      setLockDialogBusy(true);
      const savedItem = await updateItem(item.id, {
        metadata,
        locked: true,
      });

      if (!savedItem?.metadata?.accessHash || !savedItem.locked) {
        throw new Error("Access code was not saved. Please try again.");
      }

      await refresh();
      setLockDialog(null);
    } catch (error) {
      console.error("Reflection soft lock failed:", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Could not save this access code. Please try again.",
      );
    } finally {
      setLockDialogBusy(false);
    }
  }

  async function clearItemLock() {
    if (!lockDialog || lockDialog.mode !== "remove") return;

    const item = lockDialog.item;
    const metadata = { ...(item.metadata || {}) };
    delete metadata.accessHash;

    try {
      setLockDialogBusy(true);
      const savedItem = await updateItem(item.id, {
        metadata,
        locked: false,
      });

      if (savedItem?.metadata?.accessHash || savedItem?.locked) {
        throw new Error("Access code was not removed. Please try again.");
      }

      await refresh();
      setLockDialog(null);
    } catch (error) {
      console.error("Remove reflection soft lock failed:", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Could not remove this access code. Please try again.",
      );
    } finally {
      setLockDialogBusy(false);
    }
  }

  async function deleteSingleItem(item: JournalItem) {
    const ok = confirm("Delete this reflection?");
    if (!ok) return;

    await deleteItem(item.id);
    setActiveMenu(null);
  }

  async function favoriteSelectedItems() {
    if (selectedItems.length === 0) return;

    for (const item of selectedItems) {
      await updateItem(item.id, { isFavorite: true });
    }

    setSelectedIds(new Set());
    setBatchMenuOpen(false);
    onSelectionModeChange?.(false);
  }

  async function hideSelectedItems() {
    if (selectedItems.length === 0) return;

    const ok = confirm(
      `Hide ${selectedItems.length} selected reflection${
        selectedItems.length === 1 ? "" : "s"
      }?`,
    );

    if (!ok) return;

    for (const item of selectedItems) {
      await updateItem(item.id, { hiddenAt: Date.now() });
    }

    setSelectedIds(new Set());
    setBatchMenuOpen(false);
    onSelectionModeChange?.(false);
  }

  async function unhideSelectedItems() {
    if (selectedItems.length === 0) return;

    for (const item of selectedItems) {
      await updateItem(item.id, { hiddenAt: null });
    }

    setSelectedIds(new Set());
    setBatchMenuOpen(false);
    onSelectionModeChange?.(false);
  }

  async function deleteSelectedItems() {
    if (selectedItems.length === 0) return;

    const ok = confirm(
      `Delete ${selectedItems.length} selected reflection${
        selectedItems.length === 1 ? "" : "s"
      }?`,
    );

    if (!ok) return;

    for (const item of selectedItems) {
      await deleteItem(item.id);
    }

    setSelectedIds(new Set());
    setBatchMenuOpen(false);
    onSelectionModeChange?.(false);
  }

  const activeMenuOverlay = (
    <AnimatePresence>
      {activeMenu && (
        <motion.div
          className="fixed inset-0 z-[9998] bg-black/18 backdrop-blur-[1px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setActiveMenu(null)}
        >
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.97,
              y: activeMenu.position.placement === "top" ? 6 : -6,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.97,
              y: activeMenu.position.placement === "top" ? 6 : -6,
            }}
            transition={{ type: "spring", stiffness: 560, damping: 42 }}
            onClick={(event) => event.stopPropagation()}
            style={{
              top: activeMenu.position.top,
              left: activeMenu.position.left,
              width: activeMenu.position.width,
              maxHeight: `calc(100vh - ${VIEWPORT_PADDING * 2}px)`,
            }}
            className="fixed overflow-hidden rounded-[24px] border border-white/10 bg-neutral-950/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
          >
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="truncate text-[13px] font-medium text-white">
                  {activeMenu.item.title || "Conversation"}
                </div>
                {isItemSoftLocked(activeMenu.item) && (
                  <span className="shrink-0 text-[11px] text-neutral-400">
                    Lock
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-neutral-500">
                {getMessageLabel(activeMenu.item.messages.length)} ·{" "}
                {getDateLabel(activeMenu.item.createdAt)}
              </div>
            </div>

            <div className="space-y-0.5">
              <button
                onClick={() => openEntry(activeMenu.item)}
                className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
              >
                <span>Open</span>
                <span className="text-neutral-500">↗</span>
              </button>

              <button
                onClick={() => renameItem(activeMenu.item)}
                className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
              >
                <span>Rename</span>
                <span className="text-neutral-500">✎</span>
              </button>

              <button
                onClick={() => toggleFavorite(activeMenu.item)}
                className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
              >
                <span>
                  {activeMenu.item.isFavorite ? "Remove favorite" : "Favorite"}
                </span>
                <span className="text-neutral-500">
                  {activeMenu.item.isFavorite ? "♡" : "♥"}
                </span>
              </button>

              {activeMenu.item.hiddenAt ? (
                <button
                  onClick={() => unhideItem(activeMenu.item)}
                  className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
                >
                  <span>Unhide</span>
                  <span className="text-neutral-500">◎</span>
                </button>
              ) : (
                <button
                  onClick={() => hideItem(activeMenu.item)}
                  className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
                >
                  <span>Hide</span>
                  <span className="text-neutral-500">◌</span>
                </button>
              )}

              <button
                onClick={() => openSetItemLock(activeMenu.item)}
                className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
              >
                <span>
                  {isItemSoftLocked(activeMenu.item) ? "Change code" : "Lock"}
                </span>
                <span className="text-neutral-500">Lock</span>
              </button>

              {isItemSoftLocked(activeMenu.item) && (
                <button
                  onClick={() => openRemoveItemLock(activeMenu.item)}
                  className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
                >
                  <span>Remove lock</span>
                  <span className="text-neutral-500">Open</span>
                </button>
              )}

              <button
                onClick={() =>
                  router.push(`/journal/${activeMenu.item.id}/export`)
                }
                className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
              >
                <span>Export</span>
                <span className="text-neutral-500">PDF</span>
              </button>

              <div className="my-1 h-px bg-white/[0.08]" />

              <button
                onClick={() => deleteSingleItem(activeMenu.item)}
                className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-red-300 transition hover:bg-red-500/10"
              >
                <span>Delete</span>
                <span>⌫</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const batchMenuOverlay = (
    <AnimatePresence>
      {batchMenuOpen && selectedIds.size > 0 && (
        <motion.div
          className="fixed inset-0 z-[9998] bg-black/35 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setBatchMenuOpen(false)}
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
                <div className="text-[13px] font-medium text-white">
                  {selectedIds.size} selected
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-500">
                  Batch actions
                </div>
              </div>

              <div className="space-y-0.5">
                <button
                  onClick={favoriteSelectedItems}
                  className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
                >
                  <span>Mark as favorite</span>
                  <span className="text-neutral-500">♥</span>
                </button>

                {viewMode === "hidden" ? (
                  <button
                    onClick={unhideSelectedItems}
                    className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
                  >
                    <span>Unhide selected</span>
                    <span className="text-neutral-500">◎</span>
                  </button>
                ) : (
                  <button
                    onClick={hideSelectedItems}
                    className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-neutral-100 transition hover:bg-white/[0.06]"
                  >
                    <span>Hide selected</span>
                    <span className="text-neutral-500">◌</span>
                  </button>
                )}

                <div className="my-1 h-px bg-white/[0.08]" />

                <button
                  onClick={deleteSelectedItems}
                  className="flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[13px] text-red-300 transition hover:bg-red-500/10"
                >
                  <span>Delete selected</span>
                  <span>⌫</span>
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const lockDialogOverlay = (
    <AccessCodeDialog
      open={Boolean(lockDialog)}
      mode={lockDialog?.mode === "remove" ? "confirm" : "code"}
      title={
        lockDialog?.mode === "remove"
          ? "Remove code?"
          : lockDialog?.item && isItemSoftLocked(lockDialog.item)
            ? "Change code"
            : "Lock reflection"
      }
      description={
        lockDialog?.mode === "remove"
          ? "This reflection will open without asking for an access code. You can lock it again later."
          : "Set a 4–8 digit code. MindLog will ask for it every time this reflection is opened."
      }
      confirmLabel={lockDialog?.mode === "remove" ? "Remove" : "Save code"}
      destructive={lockDialog?.mode === "remove"}
      loading={lockDialogBusy}
      onClose={() => {
        if (!lockDialogBusy) setLockDialog(null);
      }}
      onConfirm={async (code) => {
        if (lockDialog?.mode === "remove") {
          await clearItemLock();
          return;
        }

        await applyItemLock(code || "");
      }}
    />
  );

  return (
    <>
      <motion.div layout className="mx-auto w-[calc(100%-14px)] space-y-3">
        <AnimatePresence initial={false}>
          {visibleItems.map((item) => {
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
                  data-journal-card="true"
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
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <h3 className="truncate text-[15px] font-medium tracking-[-0.01em] text-white">
                              {item.title || "Conversation"}
                            </h3>
                            {item.isFavorite && (
                              <span className="shrink-0 text-[17px] leading-none text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]">
                                ♥
                              </span>
                            )}
                            {isItemSoftLocked(item) && (
                              <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-neutral-300">
                                Locked
                              </span>
                            )}
                          </div>
                        </div>

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

        {hasMore && viewMode === "all" && (
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

      {mounted && createPortal(activeMenuOverlay, document.body)}
      {mounted && createPortal(batchMenuOverlay, document.body)}
      {mounted && createPortal(lockDialogOverlay, document.body)}
    </>
  );
}
