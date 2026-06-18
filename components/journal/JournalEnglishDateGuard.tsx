"use client";

import { useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useJournal, type JournalItem } from "@/components/journal/JournalContext";

type JournalViewMode = "all" | "favorites" | "hidden";

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

function getEnglishDateLabel(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function patchJournalCardDates(items: JournalItem[], viewMode: JournalViewMode) {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>("[data-journal-card='true']"),
  );
  const visibleItems = getVisibleItems(items, viewMode);

  cards.forEach((card, index) => {
    const item = visibleItems[index];
    if (!item) return;

    const footer = card.querySelector<HTMLElement>(
      "div[class*='mt-3'][class*='flex'][class*='flex-wrap']",
    );
    if (!footer) return;

    const spans = Array.from(footer.querySelectorAll<HTMLSpanElement>("span"));
    const dateSpan = spans[2];
    if (!dateSpan) return;

    dateSpan.textContent = getEnglishDateLabel(item.createdAt);
  });
}

export function JournalEnglishDateGuard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { items } = useJournal();

  useLayoutEffect(() => {
    if (pathname !== "/journal") return;

    const viewMode = getViewMode(searchParams.get("view"));
    const timers = [0, 80, 240].map((delay) =>
      window.setTimeout(() => patchJournalCardDates(items, viewMode), delay),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [items, pathname, searchParams]);

  return null;
}
