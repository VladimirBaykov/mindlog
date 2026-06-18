"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STATUS_ICON_BY_LABEL: Record<string, { name: string; icon: string }> = {
  Favorite: { name: "favorite", icon: "var(--journal-icon-heart-solid)" },
  Hidden: { name: "hidden", icon: "var(--journal-icon-eye-off)" },
  Locked: { name: "locked", icon: "var(--journal-icon-lock)" },
};

function normalizeText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function markStatusIcon(element: HTMLElement, label: string) {
  const status = STATUS_ICON_BY_LABEL[label];
  if (!status) return;

  element.dataset.mindlogStatusIcon = status.name;
  element.style.setProperty("--mindlog-status-icon", status.icon, "important");
  element.setAttribute("aria-label", label);
  element.setAttribute("title", label);
}

function hydrateStatusIcons() {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("div, span"),
  );

  for (const element of candidates) {
    const childLabels = Array.from(element.children)
      .filter((child): child is HTMLSpanElement => child.tagName.toLowerCase() === "span")
      .map((span) => normalizeText(span.textContent));

    const labelFromChild = childLabels.find((label) => STATUS_ICON_BY_LABEL[label]);
    if (labelFromChild) {
      markStatusIcon(element, labelFromChild);
      continue;
    }

    if (element.children.length > 0) continue;

    const ownLabel = normalizeText(element.textContent);
    if (STATUS_ICON_BY_LABEL[ownLabel]) {
      markStatusIcon(element, ownLabel);
    }
  }
}

export default function JournalStatusIconHydrator() {
  const pathname = usePathname();

  useEffect(() => {
    const timers = [0, 90, 260, 760, 1500].map((delay) =>
      window.setTimeout(hydrateStatusIcons, delay),
    );

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
