"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AccessCodeDialog from "@/components/journal/AccessCodeDialog";
import {
  useJournal,
  type JournalItem,
} from "@/components/journal/JournalContext";

type LockScope = "favorites" | "hidden";

type GuardFlow =
  | { kind: "reflection-new"; item: JournalItem; currentCode?: string }
  | { kind: "reflection-verify-change"; item: JournalItem }
  | { kind: "reflection-verify-remove"; item: JournalItem }
  | { kind: "reflection-confirm-remove"; item: JournalItem; currentCode: string }
  | { kind: "view-new"; scope: LockScope; currentCode?: string }
  | { kind: "view-verify-change"; scope: LockScope }
  | { kind: "view-verify-remove"; scope: LockScope }
  | { kind: "view-confirm-remove"; scope: LockScope; currentCode: string }
  | { kind: "collection-new"; collectionId: string; currentCode?: string }
  | { kind: "collection-verify-change"; collectionId: string }
  | { kind: "collection-verify-remove"; collectionId: string }
  | { kind: "collection-confirm-remove"; collectionId: string; currentCode: string };

const LOCK_LABELS = new Set([
  "Lock",
  "Set code",
  "Change code",
  "Remove lock",
  "Remove code",
]);

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

function getMessageLabel(count: number) {
  return `${count} message${count === 1 ? "" : "s"}`;
}

function getButtonLabel(button: HTMLButtonElement) {
  const firstSpan = Array.from(button.children).find(
    (child) => child.tagName.toLowerCase() === "span",
  );

  return (firstSpan?.textContent || button.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getAccessHash(item: JournalItem | null | undefined) {
  const value = item?.metadata?.accessHash;
  return typeof value === "string" && value.length > 0 ? value : "";
}

function isItemSoftLocked(item: JournalItem | null | undefined) {
  return Boolean(item?.locked || getAccessHash(item));
}

async function createAccessHash(itemId: string, code: string) {
  const input = `mindlog-entry-access-v1:${itemId}:${code}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getCurrentViewScope() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");

  return view === "favorites" || view === "hidden" ? view : null;
}

function isJournalHomePath(pathname: string | null) {
  return pathname === "/journal";
}

function getCollectionIdFromPath(pathname: string | null) {
  const match = pathname?.match(/^\/journal\/collections\/([^/]+)$/);
  return match?.[1] ?? "";
}

function getReflectionIdFromPath(pathname: string | null) {
  if (!pathname || pathname.startsWith("/journal/collections")) return "";
  const match = pathname.match(/^\/journal\/([^/]+)$/);
  return match?.[1] ?? "";
}

function inferReflectionFromMenu(button: HTMLButtonElement, items: JournalItem[]) {
  const reflectionId = getReflectionIdFromPath(window.location.pathname);
  if (reflectionId) {
    return items.find((item) => item.id === reflectionId) ?? null;
  }

  const overlay = button.closest("div.fixed") as HTMLElement | null;
  const overlayText = overlay?.textContent || "";

  return (
    items.find((item) => {
      const title = item.title || "Conversation";
      return (
        overlayText.includes(title) &&
        overlayText.includes(getMessageLabel(item.messages.length)) &&
        overlayText.includes(getDateLabel(item.createdAt))
      );
    }) ?? null
  );
}

function closeOpenMenus() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
}

function reloadSoon() {
  window.setTimeout(() => window.location.reload(), 80);
}

async function readError(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return typeof data.error === "string" ? data.error : fallback;
}

export function JournalLockSecurityGuard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { items, updateItem } = useJournal();
  const [flow, setFlow] = useState<GuardFlow | null>(null);
  const [busy, setBusy] = useState(false);

  const viewScope = useMemo<LockScope | null>(() => {
    const view = searchParams.get("view");
    return view === "favorites" || view === "hidden" ? view : null;
  }, [searchParams]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest?.("button") as HTMLButtonElement | null;
      if (!button) return;

      const label = getButtonLabel(button);
      if (!LOCK_LABELS.has(label)) return;

      const collectionId = getCollectionIdFromPath(pathname);
      const currentScope = isJournalHomePath(pathname)
        ? viewScope ?? getCurrentViewScope()
        : null;
      const reflectionItem = !collectionId
        ? inferReflectionFromMenu(button, items)
        : null;

      if (!collectionId && !currentScope && !reflectionItem) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeOpenMenus();

      if (collectionId) {
        if (label === "Set code") {
          setFlow({ kind: "collection-new", collectionId });
          return;
        }

        if (label === "Change code") {
          setFlow({ kind: "collection-verify-change", collectionId });
          return;
        }

        if (label === "Remove code") {
          setFlow({ kind: "collection-verify-remove", collectionId });
          return;
        }
      }

      if (currentScope) {
        if (label === "Set code") {
          setFlow({ kind: "view-new", scope: currentScope });
          return;
        }

        if (label === "Change code") {
          setFlow({ kind: "view-verify-change", scope: currentScope });
          return;
        }

        if (label === "Remove code") {
          setFlow({ kind: "view-verify-remove", scope: currentScope });
          return;
        }
      }

      if (reflectionItem) {
        if (label === "Lock" || label === "Set code") {
          if (isItemSoftLocked(reflectionItem)) {
            setFlow({ kind: "reflection-verify-change", item: reflectionItem });
          } else {
            setFlow({ kind: "reflection-new", item: reflectionItem });
          }
          return;
        }

        if (label === "Change code") {
          setFlow({ kind: "reflection-verify-change", item: reflectionItem });
          return;
        }

        if (label === "Remove lock" || label === "Remove code") {
          setFlow({ kind: "reflection-verify-remove", item: reflectionItem });
        }
      }
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [items, pathname, viewScope]);

  async function verifyReflectionCode(item: JournalItem, code: string) {
    const accessHash = getAccessHash(item);

    if (accessHash) {
      const nextHash = await createAccessHash(item.id, code);
      if (nextHash !== accessHash) throw new Error("Incorrect code");
      return;
    }

    if (!item.locked) return;

    const res = await fetch(`/api/journal/${item.id}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.verified) {
      throw new Error(data.error || "Incorrect code");
    }
  }

  async function verifyViewCode(scope: LockScope, code: string) {
    const res = await fetch("/api/journal/view-locks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, code }),
    });

    if (!res.ok) {
      throw new Error(await readError(res, "Incorrect code"));
    }
  }

  async function verifyCollectionCode(collectionId: string, code: string) {
    const res = await fetch(`/api/journal/collections/${collectionId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      throw new Error(await readError(res, "Incorrect code"));
    }
  }

  async function setReflectionCode(
    item: JournalItem,
    code: string,
    currentCode?: string,
  ) {
    const accessHash = await createAccessHash(item.id, code);
    const metadata = {
      ...(item.metadata || {}),
      accessHash,
    };

    await updateItem(item.id, {
      metadata,
      locked: true,
      currentCode,
    });

    closeOpenMenus();
    setFlow(null);

    if (getReflectionIdFromPath(pathname) === item.id) {
      reloadSoon();
    }
  }

  async function removeReflectionCode(item: JournalItem, currentCode: string) {
    const metadata = { ...(item.metadata || {}) };
    delete metadata.accessHash;

    await updateItem(item.id, {
      metadata,
      locked: false,
      currentCode,
    });

    closeOpenMenus();
    setFlow(null);

    if (getReflectionIdFromPath(pathname) === item.id) {
      reloadSoon();
    }
  }

  async function setViewCode(scope: LockScope, code: string, currentCode?: string) {
    const res = await fetch("/api/journal/view-locks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, code, currentCode }),
    });

    if (!res.ok) {
      throw new Error(await readError(res, "Could not update access code."));
    }

    setFlow(null);
    router.refresh();
    reloadSoon();
  }

  async function removeViewCode(scope: LockScope, currentCode: string) {
    const res = await fetch("/api/journal/view-locks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, clear: true, currentCode }),
    });

    if (!res.ok) {
      throw new Error(await readError(res, "Could not remove access code."));
    }

    setFlow(null);
    router.refresh();
    reloadSoon();
  }

  async function setCollectionCode(
    collectionId: string,
    code: string,
    currentCode?: string,
  ) {
    const res = await fetch(`/api/journal/collections/${collectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: code, currentPin: currentCode }),
    });

    if (!res.ok) {
      throw new Error(await readError(res, "Could not update access code."));
    }

    setFlow(null);
    router.refresh();
    reloadSoon();
  }

  async function removeCollectionCode(collectionId: string, currentCode: string) {
    const res = await fetch(`/api/journal/collections/${collectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearPin: true, currentPin: currentCode }),
    });

    if (!res.ok) {
      throw new Error(await readError(res, "Could not remove access code."));
    }

    setFlow(null);
    router.refresh();
    reloadSoon();
  }

  async function handleConfirm(code?: string) {
    if (!flow || busy) return;

    try {
      setBusy(true);
      const cleanCode = code || "";

      if (flow.kind === "reflection-verify-change") {
        await verifyReflectionCode(flow.item, cleanCode);
        setFlow({ kind: "reflection-new", item: flow.item, currentCode: cleanCode });
        return;
      }

      if (flow.kind === "reflection-verify-remove") {
        await verifyReflectionCode(flow.item, cleanCode);
        setFlow({
          kind: "reflection-confirm-remove",
          item: flow.item,
          currentCode: cleanCode,
        });
        return;
      }

      if (flow.kind === "reflection-new") {
        await setReflectionCode(flow.item, cleanCode, flow.currentCode);
        return;
      }

      if (flow.kind === "reflection-confirm-remove") {
        await removeReflectionCode(flow.item, flow.currentCode);
        return;
      }

      if (flow.kind === "view-verify-change") {
        await verifyViewCode(flow.scope, cleanCode);
        setFlow({ kind: "view-new", scope: flow.scope, currentCode: cleanCode });
        return;
      }

      if (flow.kind === "view-verify-remove") {
        await verifyViewCode(flow.scope, cleanCode);
        setFlow({ kind: "view-confirm-remove", scope: flow.scope, currentCode: cleanCode });
        return;
      }

      if (flow.kind === "view-new") {
        await setViewCode(flow.scope, cleanCode, flow.currentCode);
        return;
      }

      if (flow.kind === "view-confirm-remove") {
        await removeViewCode(flow.scope, flow.currentCode);
        return;
      }

      if (flow.kind === "collection-verify-change") {
        await verifyCollectionCode(flow.collectionId, cleanCode);
        setFlow({
          kind: "collection-new",
          collectionId: flow.collectionId,
          currentCode: cleanCode,
        });
        return;
      }

      if (flow.kind === "collection-verify-remove") {
        await verifyCollectionCode(flow.collectionId, cleanCode);
        setFlow({
          kind: "collection-confirm-remove",
          collectionId: flow.collectionId,
          currentCode: cleanCode,
        });
        return;
      }

      if (flow.kind === "collection-new") {
        await setCollectionCode(flow.collectionId, cleanCode, flow.currentCode);
        return;
      }

      if (flow.kind === "collection-confirm-remove") {
        await removeCollectionCode(flow.collectionId, flow.currentCode);
      }
    } finally {
      setBusy(false);
    }
  }

  const copy = useMemo(() => {
    if (!flow) {
      return {
        mode: "code" as const,
        title: "Access code",
        description: "Enter your access code.",
        confirmLabel: "Continue",
        destructive: false,
        codeLabel: "Access code",
        codePlaceholder: "Current code",
      };
    }

    if (flow.kind.includes("verify-change")) {
      return {
        mode: "code" as const,
        title: "Enter current code",
        description: "First confirm the code that is already protecting this item.",
        confirmLabel: "Continue",
        destructive: false,
        codeLabel: "Current code",
        codePlaceholder: "Current code",
      };
    }

    if (flow.kind.includes("verify-remove")) {
      return {
        mode: "code" as const,
        title: "Enter current code",
        description: "Confirm the current code before removing protection.",
        confirmLabel: "Continue",
        destructive: false,
        codeLabel: "Current code",
        codePlaceholder: "Current code",
      };
    }

    if (flow.kind.includes("confirm-remove")) {
      return {
        mode: "confirm" as const,
        title: "Remove code?",
        description: "This item will open without asking for an access code. You can lock it again later.",
        confirmLabel: "Remove",
        destructive: true,
        codeLabel: "Access code",
        codePlaceholder: "Code",
      };
    }

    return {
      mode: "code" as const,
      title: flow.kind.includes("new") && "currentCode" in flow && flow.currentCode
        ? "New code"
        : "Set code",
      description: "Choose a new 4–8 digit access code.",
      confirmLabel: "Save code",
      destructive: false,
      codeLabel: "New code",
      codePlaceholder: "New code",
    };
  }, [flow]);

  return (
    <AccessCodeDialog
      open={Boolean(flow)}
      mode={copy.mode}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      destructive={copy.destructive}
      loading={busy}
      codeLabel={copy.codeLabel}
      codePlaceholder={copy.codePlaceholder}
      onClose={() => {
        if (!busy) setFlow(null);
      }}
      onConfirm={handleConfirm}
    />
  );
}
