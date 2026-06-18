"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STATUS_LABELS = ["Favorite", "Hidden", "Locked"] as const;
type StatusLabel = (typeof STATUS_LABELS)[number];

function normalizeText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function isOpenedReflectionPath(pathname: string) {
  return /^\/journal\/(?!collections(?:\/|$))[^/]+$/.test(pathname);
}

function getStatusLabel(element: Element): StatusLabel | null {
  const text = normalizeText(element.textContent);

  if (text.includes("Favorite")) return "Favorite";
  if (text.includes("Hidden")) return "Hidden";
  if (text.includes("Locked")) return "Locked";

  return null;
}

function getStatusKey(label: StatusLabel) {
  if (label === "Favorite") return "favorite";
  if (label === "Hidden") return "hidden";
  return "locked";
}

function applyOpenedReflectionHeaderPolish(pathname: string) {
  if (!isOpenedReflectionPath(pathname)) {
    return;
  }

  const card = document.querySelector<HTMLElement>(
    ".mx-auto.max-w-xl > .mb-5.overflow-hidden.rounded-\\[32px\\]",
  );

  if (!card) return;

  card.dataset.openedReflectionHeader = "true";

  const stripe = card.querySelector<HTMLElement>(
    ":scope > .flex.gap-4 > div:first-child",
  );
  stripe?.setAttribute("data-opened-reflection-stripe", "true");

  const statusRow = card.querySelector<HTMLElement>(
    ":scope .flex.flex-wrap.items-center.gap-2",
  );
  const title = card.querySelector<HTMLHeadingElement>("h1");

  if (!statusRow || !title) return;

  const labels: StatusLabel[] = [];

  for (const child of Array.from(statusRow.children)) {
    const label = getStatusLabel(child);
    const element = child as HTMLElement;

    if (!label) {
      element.removeAttribute("data-opened-reflection-source-status");
      continue;
    }

    labels.push(label);
    element.dataset.openedReflectionSourceStatus = getStatusKey(label);
    element.setAttribute("aria-hidden", "true");
  }

  let cluster = card.querySelector<HTMLElement>(
    "[data-opened-reflection-status-cluster='true']",
  );

  if (labels.length === 0) {
    cluster?.remove();
    return;
  }

  if (!cluster) {
    cluster = document.createElement("div");
    cluster.dataset.openedReflectionStatusCluster = "true";
    card.appendChild(cluster);
  }

  cluster.replaceChildren(
    ...labels.map((label) => {
      const icon = document.createElement("span");
      icon.dataset.openedReflectionStatusIcon = getStatusKey(label);
      icon.setAttribute("aria-label", label);
      icon.setAttribute("title", label);
      return icon;
    }),
  );
}

function clearOpenedReflectionHeaderPolish() {
  for (const card of Array.from(
    document.querySelectorAll<HTMLElement>('[data-opened-reflection-header="true"]'),
  )) {
    card.removeAttribute("data-opened-reflection-header");
    card.querySelector("[data-opened-reflection-status-cluster='true']")?.remove();

    for (const element of Array.from(
      card.querySelectorAll<HTMLElement>("[data-opened-reflection-source-status]"),
    )) {
      element.removeAttribute("data-opened-reflection-source-status");
      element.removeAttribute("aria-hidden");
    }
  }
}

export default function OpenedReflectionHeaderPolish() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isOpenedReflectionPath(pathname)) {
      clearOpenedReflectionHeaderPolish();
      return;
    }

    const timers = [0, 80, 240, 700].map((delay) =>
      window.setTimeout(() => applyOpenedReflectionHeaderPolish(pathname), delay),
    );

    function refreshAfterInteraction() {
      window.setTimeout(() => applyOpenedReflectionHeaderPolish(pathname), 90);
    }

    document.addEventListener("click", refreshAfterInteraction, true);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("click", refreshAfterInteraction, true);
    };
  }, [pathname]);

  return (
    <style>{`
      [data-opened-reflection-header="true"] {
        position: relative;
      }

      [data-opened-reflection-header="true"] [data-opened-reflection-stripe="true"] {
        width: 3px !important;
        min-width: 3px !important;
        height: 4.45rem !important;
        border-radius: 999px !important;
        box-shadow:
          0 0 18px color-mix(in srgb, currentColor 28%, transparent),
          inset 0 1px 0 rgba(255, 255, 255, 0.22) !important;
      }

      [data-opened-reflection-source-status] {
        display: none !important;
      }

      [data-opened-reflection-status-cluster="true"] {
        position: absolute;
        top: 1.28rem;
        right: 4.25rem;
        z-index: 3;
        display: inline-flex;
        align-items: center;
        gap: 0.48rem;
        pointer-events: none;
      }

      [data-opened-reflection-status-icon] {
        display: inline-flex;
        width: 1.22rem;
        min-width: 1.22rem;
        height: 1.22rem;
        color: rgba(255, 255, 255, 0.88);
        filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.2));
      }

      [data-opened-reflection-status-icon="favorite"] {
        color: #ffffff;
        filter: drop-shadow(0 0 9px rgba(255, 255, 255, 0.34));
      }

      [data-opened-reflection-status-icon]::before {
        content: "";
        width: 100%;
        height: 100%;
        background: currentColor;
        -webkit-mask: var(--journal-icon-lock) center / contain no-repeat;
        mask: var(--journal-icon-lock) center / contain no-repeat;
      }

      [data-opened-reflection-status-icon="favorite"]::before {
        -webkit-mask: var(--journal-icon-heart-solid) center / contain no-repeat;
        mask: var(--journal-icon-heart-solid) center / contain no-repeat;
      }

      [data-opened-reflection-status-icon="hidden"]::before {
        -webkit-mask: var(--journal-icon-eye-off) center / contain no-repeat;
        mask: var(--journal-icon-eye-off) center / contain no-repeat;
      }

      [data-opened-reflection-status-icon="locked"]::before {
        -webkit-mask: var(--journal-icon-lock) center / contain no-repeat;
        mask: var(--journal-icon-lock) center / contain no-repeat;
      }
    `}</style>
  );
}
