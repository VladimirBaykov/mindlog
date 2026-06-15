"use client";

import { useEffect } from "react";

const ICON_BY_LABEL: Record<string, string> = {
  "Open": "var(--journal-icon-open)",
  "All reflections": "var(--journal-icon-list)",
  "Rename": "var(--journal-icon-edit)",
  "Rename title": "var(--journal-icon-edit)",
  "Favorites": "var(--journal-icon-heart)",
  "Favorite": "var(--journal-icon-heart)",
  "Remove favorite": "var(--journal-icon-heart)",
  "Mark as favorite": "var(--journal-icon-heart)",
  "Hidden": "var(--journal-icon-eye-off)",
  "Hide": "var(--journal-icon-eye-off)",
  "Hide selected": "var(--journal-icon-eye-off)",
  "Unhide": "var(--journal-icon-eye)",
  "Unhide selected": "var(--journal-icon-eye)",
  "Collections": "var(--journal-icon-folder)",
  "Add to collection": "var(--journal-icon-folder-plus)",
  "Add selected to collection": "var(--journal-icon-folder-plus)",
  "Lock": "var(--journal-icon-lock)",
  "Set code": "var(--journal-icon-lock)",
  "Change code": "var(--journal-icon-lock)",
  "Remove lock": "var(--journal-icon-unlock)",
  "Remove code": "var(--journal-icon-unlock)",
  "Export": "var(--journal-icon-export)",
  "View stats": "var(--journal-icon-chart)",
  "Upgrade": "var(--journal-icon-sparkles)",
  "Logout": "var(--journal-icon-logout)",
  "Delete": "var(--journal-icon-trash)",
  "Delete selected": "var(--journal-icon-trash)",
  "Remove collection": "var(--journal-icon-trash)",
};

function getDirectSpans(button: HTMLButtonElement) {
  return Array.from(button.children).filter(
    (child): child is HTMLSpanElement => child.tagName.toLowerCase() === "span",
  );
}

function applyMenuIcon(button: HTMLButtonElement) {
  const spans = getDirectSpans(button);
  if (spans.length < 2) return;

  const label = spans[0]?.textContent?.replace(/\s+/g, " ").trim() || "";
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

function findAccidentalBatchOverlay() {
  const overlays = Array.from(document.querySelectorAll("div.fixed.inset-0"));

  return overlays.find((overlay) => {
    const text = overlay.textContent || "";
    return text.includes("Batch actions") && text.includes("selected");
  }) as HTMLElement | undefined;
}

export function JournalMenuRuntimeGuard() {
  useEffect(() => {
    let selectedActionsRequestedUntil = 0;
    let closeTimer: number | null = null;

    function markSelectedActionsRequest(event: Event) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest?.("button[aria-label='Open selected actions']");
      if (!button) return;

      selectedActionsRequestedUntil = Date.now() + 1200;
    }

    function closeAccidentalBatchMenu() {
      if (Date.now() <= selectedActionsRequestedUntil) return;

      const overlay = findAccidentalBatchOverlay();
      if (!overlay) return;

      overlay.click();
    }

    function handleDomChange() {
      applyMenuIcons();

      if (closeTimer) {
        window.clearTimeout(closeTimer);
      }

      closeTimer = window.setTimeout(closeAccidentalBatchMenu, 16);
    }

    document.addEventListener("pointerdown", markSelectedActionsRequest, true);
    document.addEventListener("click", markSelectedActionsRequest, true);

    applyMenuIcons();

    const observer = new MutationObserver(handleDomChange);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      document.removeEventListener("pointerdown", markSelectedActionsRequest, true);
      document.removeEventListener("click", markSelectedActionsRequest, true);
      observer.disconnect();

      if (closeTimer) {
        window.clearTimeout(closeTimer);
      }
    };
  }, []);

  return null;
}
