"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useToast } from "@/components/ui/ToastContext";

const COLLECTIONS_PATH = "/journal/collections";
const MENU_SELECTOR = "div.absolute.right-3.z-30";
const ACTION_BUTTON_SELECTOR = "button[aria-label='Collection actions']";

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return "GET";
}

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input);
}

function getCollectionDeleteId(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    const match = parsed.pathname.match(/^\/api\/journal\/collections\/([^/]+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function placeMenuFromButton(button: HTMLButtonElement) {
  const card = button.closest(".relative.w-full.rounded-\\[26px\\]");
  if (!card) return;

  const menu = card.querySelector<HTMLElement>(MENU_SELECTOR);
  if (!menu) return;

  const rect = button.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const spaceBelow = viewportHeight - rect.bottom;
  const shouldOpenAbove = rect.top > viewportHeight * 0.52 || spaceBelow < 315;
  const availableSpace = shouldOpenAbove ? Math.max(220, rect.top - 22) : Math.max(220, spaceBelow - 22);

  menu.style.setProperty("top", shouldOpenAbove ? "auto" : "60px", "important");
  menu.style.setProperty("bottom", shouldOpenAbove ? "56px" : "auto", "important");
  menu.style.setProperty("max-height", `min(72vh, ${availableSpace}px)`, "important");
  menu.style.setProperty("overflow-y", "auto", "important");
  menu.style.setProperty("overscroll-behavior", "contain", "important");
  menu.style.setProperty("transform-origin", shouldOpenAbove ? "bottom right" : "top right", "important");
}

function scheduleMenuPlacement(button: HTMLButtonElement) {
  requestAnimationFrame(() => {
    placeMenuFromButton(button);
    requestAnimationFrame(() => placeMenuFromButton(button));
  });
}

export function CollectionsPageBehavior() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const { showUndo, showError } = useToast();

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (pathnameRef.current !== COLLECTIONS_PATH) return;

      const target = event.target as HTMLElement | null;
      const button = target?.closest?.(ACTION_BUTTON_SELECTOR) as HTMLButtonElement | null;
      if (!button) return;

      scheduleMenuPlacement(button);
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("resize", () => {
      const activeButton = document.querySelector<HTMLButtonElement>(ACTION_BUTTON_SELECTOR);
      if (activeButton) scheduleMenuPlacement(activeButton);
    });

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = getRequestMethod(input, init);
      const url = getRequestUrl(input);
      const collectionId =
        pathnameRef.current === COLLECTIONS_PATH && method === "DELETE"
          ? getCollectionDeleteId(url)
          : null;

      const response = await nativeFetch(input, init);

      if (collectionId && response.ok) {
        showUndo("Collection removed", () => {
          void nativeFetch(`/api/journal/collections/${collectionId}/restore`, {
            method: "POST",
          })
            .then((restoreResponse) => {
              if (!restoreResponse.ok) throw new Error("Restore failed");
              window.location.reload();
            })
            .catch(() => showError("Restore failed"));
        });
      }

      return response;
    };

    return () => {
      window.fetch = nativeFetch;
    };
  }, [showError, showUndo]);

  return null;
}
