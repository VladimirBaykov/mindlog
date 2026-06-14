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
import CollectionPickerDialog from "@/components/journal/CollectionPickerDialog";
import TextInputDialog from "@/components/journal/TextInputDialog";

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

type RenameDialogState = {
  item: JournalItem;
};

type LockDialogState =
  | { mode: "set"; item: JournalItem }
  | { mode: "remove"; item: JournalItem };

type CollectionDialogState = {
  items: JournalItem[];
  source: "single" | "batch";
};

type ConfirmDialogState =
  | { type: "delete-single"; item: JournalItem }
  | { type: "hide-selected"; items: JournalItem[] }
  | { type: "delete-selected"; items: JournalItem[] };

type JournalListProps = {
  viewMode?: JournalViewMode;
  selectionMode?: boolean;
  batchActionRequest?: number;
  onSelectionModeChange?: (nextValue: boolean) => void;
  onSelectionChange?: (count: number) => void;
};

const MENU_ESTIMATED_HEIGHT = 330;
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

  if (lowSignalExact.includes(normalized)) return true;
  if (normalized.length <= 12) return true;

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

  if (meaningfulUserMessage) return meaningfulUserMessage.content;

  const firstUserMessage = item.messages.find(
    (message) => message.role === "user",
  );

  if (firstUserMessage) return firstUserMessage.content;

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

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

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
  const maxMenuWidth = Math.min(320, viewportWidth - VIEWPORT_PADDING * 2);
  const width = Math.min(Math.max(rect.width * 0.78, 244), maxMenuWidth);

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

function ActionIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-4 shrink-0 min-w-8 text-right text-[13px] font-semibold leading-none text-neutral-500">
      {children}
    </span>
  );
}

function ActionButton({
  children,
  icon,
  destructive = false,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-[12px] transition ${
        destructive
          ? "text-red-300 hover:bg-red-500/10"
          : "text-neutral-100 hover:bg-white/[0.06]"
      }`}
    >
      <span className="truncate">{children}</span>
      <ActionIcon>{icon}</ActionIcon>
    </button>
  );
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
  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(
    null,
  );
  const [renameDialogBusy, setRenameDialogBusy] = useState(false);
  const [lockDialog, setLockDialog] = useState<LockDialogState | null>(null);
  const [lockDialogBusy, setLockDialogBusy] = useState(false);
  const [collectionDialog, setCollectionDialog] =
    useState<CollectionDialogState | null>(null);
  const [collectionDialogBusy, setCollectionDialogBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(
    null,
  );
  const [confirmDialogBusy, setConfirmDialogBusy] = useState(false);
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
        if (!renameDialogBusy) setRenameDialog(null);
        if (!lockDialogBusy) setLockDialog(null);
        if (!collectionDialogBusy) setCollectionDialog(null);
        if (!confirmDialogBusy) setConfirmDialog(null);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [
    collectionDialogBusy,
    confirmDialogBusy,
    lockDialogBusy,
    renameDialogBusy,
  ]);

  if (loading) return <JournalSkeleton />;
  if (visibleItems.length === 0) return <EmptyView viewMode={viewMode} />;

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openEntry(item: JournalItem) {
    if (item.id === activeId) return;
    setActiveMenu(null);
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

  function openRenameItem(item: JournalItem) {
    setActiveMenu(null);
    setRenameDialog({ item });
  }

  async function applyRename(nextTitle: string) {
    if (!renameDialog) return;

    const item = renameDialog.item;
    const cleanTitle = nextTitle.trim();

    if (!cleanTitle || cleanTitle === item.title) {
      setRenameDialog(null);
      return;
    }

    try {
      setRenameDialogBusy(true);
      await updateItem(item.id, { title: cleanTitle });
      setRenameDialog(null);
    } finally {
      setRenameDialogBusy(false);
    }
  }

  async function toggleFavorite(item: JournalItem) {
    await updateItem(item.id, { isFavorite: !item.isFavorite });
    setActiveMenu(null);
  }

  async function hideItem(item: JournalItem) {
    await updateItem(item.id, { hiddenAt: Date.now() });
    setActiveMenu(null);
  }

  async function unhideItem(item: JournalItem) {
    await updateItem(item.id, { hiddenAt: null });
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

  function openAddToCollection(
    itemsToAdd: JournalItem[],
    source: "single" | "batch",
  ) {
    if (itemsToAdd.length === 0) return;
    setActiveMenu(null);
    setBatchMenuOpen(false);
    setCollectionDialog({ items: itemsToAdd, source });
  }

  function openDeleteSingle(item: JournalItem) {
    setActiveMenu(null);
    setConfirmDialog({ type: "delete-single", item });
  }

  function openHideSelected() {
    if (selectedItems.length === 0) return;
    setBatchMenuOpen(false);
    setConfirmDialog({ type: "hide-selected", items: selectedItems });
  }

  function openDeleteSelected() {
    if (selectedItems.length === 0) return;
    setBatchMenuOpen(false);
    setConfirmDialog({ type: "delete-selected", items: selectedItems });
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

  async function addDialogItemsToCollection(collectionId: string) {
    if (!collectionDialog) return;

    const journalIds = collectionDialog.items.map((item) => item.id);

    try {
      setCollectionDialogBusy(true);
      const res = await fetch(
        `/api/journal/collections/${encodeURIComponent(collectionId)}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journalIds }),
        },
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Could not add to this collection.");
      }

      if (collectionDialog.source === "batch") {
        setSelectedIds(new Set());
        onSelectionModeChange?.(false);
      }

      setCollectionDialog(null);
    } catch (error) {
      console.error("Add to collection failed:", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Could not add to this collection.",
      );
    } finally {
      setCollectionDialogBusy(false);
    }
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

  async function hideSelectedItems(itemsToHide = selectedItems) {
    if (itemsToHide.length === 0) return;

    for (const item of itemsToHide) {
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

  function deleteSingleItem(item: JournalItem) {
    setConfirmDialog(null);
    window.setTimeout(() => {
      void deleteItem(item.id);
    }, 80);
  }

  function deleteSelectedItems(itemsToDelete: JournalItem[]) {
    setConfirmDialog(null);
    setSelectedIds(new Set());
    setBatchMenuOpen(false);
    onSelectionModeChange?.(false);

    window.setTimeout(() => {
      void (async () => {
        for (const item of itemsToDelete) {
          await deleteItem(item.id);
        }
      })();
    }, 80);
  }

  async function runConfirmDialogAction() {
    if (!confirmDialog) return;

    if (confirmDialog.type === "delete-single") {
      deleteSingleItem(confirmDialog.item);
      return;
    }

    if (confirmDialog.type === "delete-selected") {
      deleteSelectedItems(confirmDialog.items);
      return;
    }

    try {
      setConfirmDialogBusy(true);
      if (confirmDialog.type === "hide-selected") {
        await hideSelectedItems(confirmDialog.items);
        setConfirmDialog(null);
      }
    } finally {
      setConfirmDialogBusy(false);
    }
  }

  function getConfirmDialogCopy() {
    if (!confirmDialog) {
      return {
        title: "Confirm action",
        description: "Please confirm this action.",
        confirmLabel: "Confirm",
        destructive: false,
      };
    }

    if (confirmDialog.type === "delete-single") {
      return {
        title: "Delete reflection?",
        description:
          "This reflection will be removed from your journal. You can undo it briefly after deletion.",
        confirmLabel: "Delete",
        destructive: true,
      };
    }

    if (confirmDialog.type === "hide-selected") {
      const count = confirmDialog.items.length;
      return {
        title: `Hide ${count} reflection${count === 1 ? "" : "s"}?`,
        description:
          "Hidden reflections stay out of your main journal and can be restored from Hidden later.",
        confirmLabel: "Hide",
        destructive: false,
      };
    }

    const count = confirmDialog.items.length;
    return {
      title: `Delete ${count} reflection${count === 1 ? "" : "s"}?`,
      description:
        "These reflections will be removed from your journal. You can undo them briefly after deletion.",
      confirmLabel: "Delete",
      destructive: true,
    };
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
              <ActionButton icon="↗" onClick={() => openEntry(activeMenu.item)}>
                Open
              </ActionButton>

              <ActionButton
                icon="✎"
                onClick={() => openRenameItem(activeMenu.item)}
              >
                Rename
              </ActionButton>

              <ActionButton
                icon={activeMenu.item.isFavorite ? "♡" : "♥"}
                onClick={() => toggleFavorite(activeMenu.item)}
              >
                {activeMenu.item.isFavorite ? "Remove favorite" : "Favorite"}
              </ActionButton>

              {activeMenu.item.hiddenAt ? (
                <ActionButton icon="◎" onClick={() => unhideItem(activeMenu.item)}>
                  Unhide
                </ActionButton>
              ) : (
                <ActionButton icon="◌" onClick={() => hideItem(activeMenu.item)}>
                  Hide
                </ActionButton>
              )}

              <ActionButton
                icon="＋"
                onClick={() => openAddToCollection([activeMenu.item], "single")}
              >
                Add to collection
              </ActionButton>

              <ActionButton
                icon="⌁"
                onClick={() => openSetItemLock(activeMenu.item)}
              >
                {isItemSoftLocked(activeMenu.item) ? "Change code" : "Lock"}
              </ActionButton>

              {isItemSoftLocked(activeMenu.item) && (
                <ActionButton
                  icon="○"
                  onClick={() => openRemoveItemLock(activeMenu.item)}
                >
                  Remove lock
                </ActionButton>
              )}

              <ActionButton
                icon="PDF"
                onClick={() => router.push(`/journal/${activeMenu.item.id}/export`)}
              >
                Export
              </ActionButton>

              <div className="my-1 h-px bg-white/[0.08]" />

              <ActionButton
                destructive
                icon="⌫"
                onClick={() => openDeleteSingle(activeMenu.item)}
              >
                Delete
              </ActionButton>
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
                <ActionButton icon="♥" onClick={favoriteSelectedItems}>
                  Mark as favorite
                </ActionButton>

                <ActionButton
                  icon="＋"
                  onClick={() => openAddToCollection(selectedItems, "batch")}
                >
                  Add selected to collection
                </ActionButton>

                {viewMode === "hidden" ? (
                  <ActionButton icon="◎" onClick={unhideSelectedItems}>
                    Unhide selected
                  </ActionButton>
                ) : (
                  <ActionButton icon="◌" onClick={openHideSelected}>
                    Hide selected
                  </ActionButton>
                )}

                <div className="my-1 h-px bg-white/[0.08]" />

                <ActionButton destructive icon="⌫" onClick={openDeleteSelected}>
                  Delete selected
                </ActionButton>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renameDialogOverlay = (
    <TextInputDialog
      open={Boolean(renameDialog)}
      title="Rename reflection"
      description="Give this saved reflection a short, clear title."
      initialValue={renameDialog?.item.title || ""}
      label="Reflection title"
      placeholder="New title"
      confirmLabel="Save title"
      loading={renameDialogBusy}
      maxLength={80}
      onClose={() => {
        if (!renameDialogBusy) setRenameDialog(null);
      }}
      onConfirm={applyRename}
    />
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

  const collectionDialogOverlay = (
    <CollectionPickerDialog
      open={Boolean(collectionDialog)}
      title="Add to collection"
      description="Choose where MindLog should organize this reflection. The original will stay in your Journal."
      selectedCount={collectionDialog?.items.length ?? 0}
      loading={collectionDialogBusy}
      onClose={() => {
        if (!collectionDialogBusy) setCollectionDialog(null);
      }}
      onConfirm={addDialogItemsToCollection}
    />
  );

  const confirmCopy = getConfirmDialogCopy();

  const confirmDialogOverlay = (
    <AccessCodeDialog
      open={Boolean(confirmDialog)}
      mode="confirm"
      title={confirmCopy.title}
      description={confirmCopy.description}
      confirmLabel={confirmCopy.confirmLabel}
      destructive={confirmCopy.destructive}
      loading={confirmDialogBusy}
      onClose={() => {
        if (!confirmDialogBusy) setConfirmDialog(null);
      }}
      onConfirm={runConfirmDialogAction}
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
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
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
      {mounted && createPortal(renameDialogOverlay, document.body)}
      {mounted && createPortal(lockDialogOverlay, document.body)}
      {mounted && createPortal(collectionDialogOverlay, document.body)}
      {mounted && createPortal(confirmDialogOverlay, document.body)}
    </>
  );
}
