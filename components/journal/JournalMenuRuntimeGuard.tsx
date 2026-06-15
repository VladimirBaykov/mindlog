"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  useJournal,
  type JournalItem,
} from "@/components/journal/JournalContext";

type JournalViewMode = "all" | "favorites" | "hidden";

const ICON_BY_LABEL: Record<string, string> = {
  Open: "var(--journal-icon-open)",
  "All reflections": "var(--journal-icon-list)",
  Rename: "var(--journal-icon-edit)",
  "Rename title": "var(--journal-icon-edit)",
  Favorites: "var(--journal-icon-heart)",
  Favorite: "var(--journal-icon-heart)",
  "Remove favorite": "var(--journal-icon-heart)",
  "Remove favorites": "var(--journal-icon-heart)",
  "Mark as favorite": "var(--journal-icon-heart)",
  Hidden: "var(--journal-icon-eye-off)",
  Hide: "var(--journal-icon-eye-off)",
  "Hide selected": "var(--journal-icon-eye-off)",
  Unhide: "var(--journal-icon-eye)",
  "Unhide selected": "var(--journal-icon-eye)",
  Collections: "var(--journal-icon-folder)",
  "Add to collection": "var(--journal-icon-folder-plus)",
  "Add selected to collection": "var(--journal-icon-folder-plus)",
  Lock: "var(--journal-icon-lock)",
  "Set code": "var(--journal-icon-lock)",
  "Change code": "var(--journal-icon-lock)",
  "Remove lock": "var(--journal-icon-unlock)",
  "Remove code": "var(--journal-icon-unlock)",
  Export: "var(--journal-icon-export)",
  "View stats": "var(--journal-icon-chart)",
  Upgrade: "var(--journal-icon-sparkles)",
  Logout: "var(--journal-icon-logout)",
  Delete: "var(--journal-icon-trash)",
  "Delete selected": "var(--journal-icon-trash)",
  "Remove collection": "var(--journal-icon-trash)",
};

function getViewMode(value: string | null): JournalViewMode {
  if (value === "favorites" || value === "hidden") return value;
  return "all";
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

function getDirectSpans(button: HTMLButtonElement) {
  return Array.from(button.children).filter(
    (child): child is HTMLSpanElement => child.tagName.toLowerCase() === "span",
  );
}

function getButtonLabel(button: HTMLButtonElement) {
  const spans = getDirectSpans(button);
  return spans[0]?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function setButtonLabel(button: HTMLButtonElement, label: string) {
  const spans = getDirectSpans(button);
  if (!spans[0]) return;
  spans[0].textContent = label;
}

function applyMenuIcon(button: HTMLButtonElement) {
  const spans = getDirectSpans(button);
  if (spans.length < 2) return;

  const label = getButtonLabel(button);
  const icon = ICON_BY_LABEL[label];
  if (!icon) return;

  const iconSlot = spans[spans.length - 1];
  iconSlot.style.setProperty("--journal-action-icon", icon, "important");
}

function applyMenuIcons() {
  for (const button of Array.from(document.querySelectorAll("button"))) {
    applyMenuIcon(button as HTMLButtonElement);
  }
}

function findBatchOverlay() {
  const overlays = Array.from(document.querySelectorAll("div.fixed.inset-0"));

  return overlays.find((overlay) => {
    const text = overlay.textContent || "";
    return text.includes("Batch actions") && text.includes("selected");
  }) as HTMLElement | undefined;
}

function findBatchActionMenu() {
  const overlay = findBatchOverlay();
  if (!overlay) return null;

  const menu = overlay.querySelector(".space-y-0\\.5") as HTMLElement | null;
  if (!menu) return null;

  return { overlay, menu };
}

function isSelectedCard(card: HTMLElement) {
  const className = card.getAttribute("class") || "";
  return (
    className.includes("border-white/35") ||
    className.includes("bg-white/[0.09]")
  );
}

function getSelectedItems(items: JournalItem[], viewMode: JournalViewMode) {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>("[data-journal-card='true']"),
  );
  const visibleItems = getVisibleItems(items, viewMode);

  return cards
    .map((card, index) => (isSelectedCard(card) ? visibleItems[index] : null))
    .filter((item): item is JournalItem => Boolean(item));
}

function closeSelectionMode() {
  const exitButton = document.querySelector<HTMLButtonElement>(
    "button[aria-label='Exit selection']",
  );
  exitButton?.click();
}

function createDynamicFavoriteButton(referenceButton: HTMLButtonElement) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.mindlogDynamicFavorite = "remove";
  button.className = referenceButton.className;
  button.innerHTML = `<span>Remove favorites</span><span class="text-neutral-500">♡</span>`;
  return button;
}

function getOrCreateDynamicFavoriteButton(
  menu: HTMLElement,
  referenceButton: HTMLButtonElement,
) {
  const existing = menu.querySelector<HTMLButtonElement>(
    "button[data-mindlog-dynamic-favorite='remove']",
  );

  if (existing) return existing;

  const button = createDynamicFavoriteButton(referenceButton);
  referenceButton.insertAdjacentElement("afterend", button);
  return button;
}

function setFavoriteButtonMode(
  button: HTMLButtonElement,
  ids: string[],
  nextValue: boolean,
) {
  button.dataset.mindlogBatchFavoriteValue = String(nextValue);
  button.dataset.mindlogBatchFavoriteIds = ids.join(",");
}

function installBatchFavoriteHandler(
  button: HTMLButtonElement,
  updateItem: (id: string, patch: { isFavorite: boolean }) => Promise<unknown>,
) {
  if (button.dataset.mindlogBatchFavoriteHandler === "1") return;

  button.dataset.mindlogBatchFavoriteHandler = "1";
  button.addEventListener(
    "click",
    (event) => {
      const rawValue = button.dataset.mindlogBatchFavoriteValue;
      const ids = (button.dataset.mindlogBatchFavoriteIds || "")
        .split(",")
        .filter(Boolean);

      if (!rawValue || ids.length === 0) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const nextValue = rawValue === "true";

      void (async () => {
        for (const id of ids) {
          await updateItem(id, { isFavorite: nextValue });
        }

        closeSelectionMode();
      })();
    },
    true,
  );
}

function syncBatchFavoriteActions(
  items: JournalItem[],
  viewMode: JournalViewMode,
  updateItem: (id: string, patch: { isFavorite: boolean }) => Promise<unknown>,
) {
  const batch = findBatchActionMenu();
  if (!batch) return;

  const selectedItems = getSelectedItems(items, viewMode);
  if (selectedItems.length === 0) return;

  const buttons = Array.from(
    batch.menu.querySelectorAll<HTMLButtonElement>("button"),
  );
  const favoriteButton = buttons.find((button) => {
    const label = getButtonLabel(button);
    return (
      label === "Mark as favorite" ||
      label === "Remove favorite" ||
      label === "Remove favorites"
    );
  });

  if (!favoriteButton) return;

  const favoriteItems = selectedItems.filter((item) => item.isFavorite);
  const notFavoriteItems = selectedItems.filter((item) => !item.isFavorite);
  const dynamicRemoveButton = batch.menu.querySelector<HTMLButtonElement>(
    "button[data-mindlog-dynamic-favorite='remove']",
  );

  if (notFavoriteItems.length === 0) {
    dynamicRemoveButton?.remove();
    setButtonLabel(
      favoriteButton,
      selectedItems.length === 1 ? "Remove favorite" : "Remove favorites",
    );
    setFavoriteButtonMode(
      favoriteButton,
      favoriteItems.map((item) => item.id),
      false,
    );
    installBatchFavoriteHandler(favoriteButton, updateItem);
    applyMenuIcon(favoriteButton);
    return;
  }

  favoriteButton.dataset.mindlogBatchFavoriteValue = "";
  favoriteButton.dataset.mindlogBatchFavoriteIds = "";
  setButtonLabel(favoriteButton, "Mark as favorite");
  applyMenuIcon(favoriteButton);

  if (favoriteItems.length === 0) {
    dynamicRemoveButton?.remove();
    return;
  }

  const removeButton = getOrCreateDynamicFavoriteButton(batch.menu, favoriteButton);
  setFavoriteButtonMode(
    removeButton,
    favoriteItems.map((item) => item.id),
    false,
  );
  installBatchFavoriteHandler(removeButton, updateItem);
  applyMenuIcon(removeButton);
}

export function JournalMenuRuntimeGuard() {
  const searchParams = useSearchParams();
  const { items, updateItem } = useJournal();

  useEffect(() => {
    let selectedActionsRequestedUntil = 0;
    let suppressAccidentalBatchUntil = 0;
    const timers: number[] = [];

    function addTimer(callback: () => void, delay: number) {
      const id = window.setTimeout(callback, delay);
      timers.push(id);
    }

    function hydrateOpenMenus() {
      const viewMode = getViewMode(searchParams.get("view"));
      applyMenuIcons();
      syncBatchFavoriteActions(items, viewMode, updateItem);
    }

    function closeAccidentalBatchMenu() {
      if (Date.now() <= selectedActionsRequestedUntil) return;

      const overlay = findBatchOverlay();
      if (!overlay) return;

      overlay.style.setProperty("display", "none", "important");
      overlay.style.setProperty("opacity", "0", "important");
      overlay.style.setProperty("pointer-events", "none", "important");
      overlay.click();
    }

    function scheduleAccidentalBatchClose() {
      addTimer(closeAccidentalBatchMenu, 0);
      addTimer(closeAccidentalBatchMenu, 40);
      addTimer(closeAccidentalBatchMenu, 120);
    }

    function markSelectedActionsRequest(event: Event) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest?.("button[aria-label='Open selected actions']");
      if (!button) return;

      document.body.classList.remove("mindlog-suppress-selected-actions");
      selectedActionsRequestedUntil = Date.now() + 1200;
      addTimer(hydrateOpenMenus, 0);
      addTimer(hydrateOpenMenus, 60);
      addTimer(hydrateOpenMenus, 180);
    }

    function markSelectionTap(event: Event) {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("button[aria-label='Open selected actions']")) return;
      if (!target?.closest?.("[data-journal-card='true']")) return;
      if (!document.querySelector("button[aria-label='Exit selection']")) return;

      suppressAccidentalBatchUntil = Date.now() + 650;
      document.body.classList.add("mindlog-suppress-selected-actions");
      scheduleAccidentalBatchClose();

      addTimer(() => {
        if (Date.now() > suppressAccidentalBatchUntil) {
          document.body.classList.remove("mindlog-suppress-selected-actions");
        }
      }, 700);
    }

    function refreshIconsAfterClick() {
      addTimer(applyMenuIcons, 40);
    }

    document.addEventListener("pointerdown", markSelectionTap, true);
    document.addEventListener("pointerdown", markSelectedActionsRequest, true);
    document.addEventListener("click", markSelectedActionsRequest, true);
    document.addEventListener("click", refreshIconsAfterClick, true);

    hydrateOpenMenus();

    return () => {
      document.removeEventListener("pointerdown", markSelectionTap, true);
      document.removeEventListener("pointerdown", markSelectedActionsRequest, true);
      document.removeEventListener("click", markSelectedActionsRequest, true);
      document.removeEventListener("click", refreshIconsAfterClick, true);
      document.body.classList.remove("mindlog-suppress-selected-actions");
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [items, searchParams, updateItem]);

  return null;
}
