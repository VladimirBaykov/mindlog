"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type CollectionItem = {
  id: string;
  is_favorite?: boolean | null;
  isFavorite?: boolean | null;
  locked?: boolean | null;
  hidden_at?: string | null;
  hiddenAt?: number | null;
  metadata?: {
    accessHash?: string;
  } | null;
};

type CollectionResponse = {
  items?: CollectionItem[];
};

const STATUS_TEXT_TO_KIND: Record<string, "favorite" | "hidden" | "locked"> = {
  Favorite: "favorite",
  Hidden: "hidden",
  Locked: "locked",
};

function getCollectionIdFromPath(pathname: string) {
  const match = pathname.match(/^\/journal\/collections\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

function isOpenReflectionPath(pathname: string) {
  return /^\/journal\/(?!collections(?:\/|$))[^/]+$/.test(pathname);
}

function isCollectionDetailPath(pathname: string) {
  return /^\/journal\/collections\/[^/]+$/.test(pathname);
}

function polishOpenedReflectionStatuses() {
  for (const element of Array.from(document.querySelectorAll<HTMLElement>("div"))) {
    const text = element.textContent?.trim() || "";
    const kind = STATUS_TEXT_TO_KIND[text];
    if (!kind) continue;

    const className = element.getAttribute("class") || "";
    const isSmallChip =
      className.includes("rounded-full") &&
      className.includes("px-2.5") &&
      className.includes("text-[11px]");

    if (!isSmallChip) continue;

    element.dataset.mindlogOpenedStatus = kind;
    element.setAttribute(
      "aria-label",
      kind === "favorite" ? "Favorite" : kind === "hidden" ? "Hidden" : "Locked",
    );
  }
}

function getCollectionCards() {
  return Array.from(document.querySelectorAll<HTMLElement>("div.relative.w-full.overflow-hidden"))
    .filter((card) => {
      const className = card.getAttribute("class") || "";
      return className.includes("rounded-[26px]") && card.querySelector("button.text-left");
    });
}

function getItemState(item: CollectionItem | undefined) {
  return {
    favorite: Boolean(item?.isFavorite ?? item?.is_favorite),
    hidden: Boolean(item?.hiddenAt ?? item?.hidden_at),
    locked: Boolean(item?.locked || item?.metadata?.accessHash),
  };
}

function makeStatusIcon(kind: "favorite" | "hidden" | "locked") {
  const icon = document.createElement("span");
  icon.className = "mindlog-scoped-status-icon";
  icon.dataset.mindlogScopedStatus = kind;
  icon.setAttribute(
    "aria-label",
    kind === "favorite" ? "Favorite" : kind === "hidden" ? "Hidden" : "Locked",
  );
  return icon;
}

function applyCollectionCardStatuses(items: CollectionItem[]) {
  const cards = getCollectionCards();

  cards.forEach((card, index) => {
    const item = items[index];
    const state = getItemState(item);
    const titleRow = card.querySelector<HTMLElement>("button.text-left div.flex.items-center.gap-2");

    if (!titleRow) return;

    for (const badge of Array.from(titleRow.children)) {
      if (badge.textContent?.trim() === "Locked") {
        badge.remove();
      }
    }

    const existing = titleRow.querySelector(".mindlog-scoped-status-icons");
    existing?.remove();

    if (!state.favorite && !state.hidden && !state.locked) return;

    const statusWrap = document.createElement("span");
    statusWrap.className = "mindlog-scoped-status-icons";

    if (state.favorite) statusWrap.appendChild(makeStatusIcon("favorite"));
    if (state.hidden) statusWrap.appendChild(makeStatusIcon("hidden"));
    if (state.locked) statusWrap.appendChild(makeStatusIcon("locked"));

    titleRow.appendChild(statusWrap);
  });
}

export function JournalScopedStatusPolish() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];

    function addTimer(callback: () => void, delay: number) {
      const timer = window.setTimeout(() => {
        if (!cancelled) callback();
      }, delay);
      timers.push(timer);
    }

    if (isOpenReflectionPath(pathname)) {
      addTimer(polishOpenedReflectionStatuses, 0);
      addTimer(polishOpenedReflectionStatuses, 80);
      addTimer(polishOpenedReflectionStatuses, 240);
      addTimer(polishOpenedReflectionStatuses, 650);
    }

    if (isCollectionDetailPath(pathname)) {
      const collectionId = getCollectionIdFromPath(pathname);

      if (collectionId) {
        void fetch(`/api/journal/collections/${collectionId}`, { cache: "no-store" })
          .then(async (res) => {
            if (!res.ok) return null;
            return (await res.json()) as CollectionResponse;
          })
          .then((data) => {
            if (!data?.items || cancelled) return;
            addTimer(() => applyCollectionCardStatuses(data.items || []), 0);
            addTimer(() => applyCollectionCardStatuses(data.items || []), 100);
            addTimer(() => applyCollectionCardStatuses(data.items || []), 300);
            addTimer(() => applyCollectionCardStatuses(data.items || []), 700);
          })
          .catch((error) => {
            console.error("Collection status polish failed:", error);
          });
      }
    }

    return () => {
      cancelled = true;
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [pathname]);

  return (
    <style>{`
      [data-mindlog-opened-status] {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 1.06rem !important;
        min-width: 1.06rem !important;
        height: 1.06rem !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        color: rgba(255, 255, 255, 0.86) !important;
        font-size: 0 !important;
        line-height: 0 !important;
        filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.18));
      }

      [data-mindlog-opened-status] > * {
        display: none !important;
      }

      [data-mindlog-opened-status]::before,
      .mindlog-scoped-status-icon::before {
        content: "" !important;
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        background: currentColor !important;
        -webkit-mask: var(--mindlog-status-mask) center / contain no-repeat !important;
        mask: var(--mindlog-status-mask) center / contain no-repeat !important;
      }

      [data-mindlog-opened-status="favorite"],
      .mindlog-scoped-status-icon[data-mindlog-scoped-status="favorite"] {
        --mindlog-status-mask: var(--journal-icon-heart-solid);
        color: #ffffff !important;
      }

      [data-mindlog-opened-status="hidden"],
      .mindlog-scoped-status-icon[data-mindlog-scoped-status="hidden"] {
        --mindlog-status-mask: var(--journal-icon-eye-off);
      }

      [data-mindlog-opened-status="locked"],
      .mindlog-scoped-status-icon[data-mindlog-scoped-status="locked"] {
        --mindlog-status-mask: var(--journal-icon-lock);
      }

      .mindlog-scoped-status-icons {
        display: inline-flex !important;
        align-items: center !important;
        gap: 0.35rem !important;
        margin-left: 0.15rem !important;
        flex-shrink: 0 !important;
      }

      .mindlog-scoped-status-icon {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 1rem !important;
        min-width: 1rem !important;
        height: 1rem !important;
        color: rgba(255, 255, 255, 0.84) !important;
        filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.16));
      }
    `}</style>
  );
}
